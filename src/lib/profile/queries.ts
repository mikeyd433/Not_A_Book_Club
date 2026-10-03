import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'
import { resizeSquareForUpload } from '@/lib/image'

export function avatarPublicUrl(storagePath: string) {
  return supabase.storage.from('avatars').getPublicUrl(storagePath).data.publicUrl
}

export function useMyProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-profile', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, has_seen_tutorial')
        .eq('id', user!.id)
        .single()

      if (error) throw error
      return data
    },
  })
}

// Same shape as useMyProfile but for viewing someone else's -- the
// "profiles are readable by authenticated users" RLS policy already
// allows reading any member's profile, not just your own.
export function useMemberProfile(userId: string) {
  return useQuery({
    queryKey: ['member-profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', userId)
        .single()

      if (error) throw error
      return data
    },
  })
}

// display_name/avatar_url are embedded by their own
// select('profiles(...)') in a lot of places (comments, group members,
// ratings, ...) rather than one shared query, so there's no single cache
// key to invalidate everywhere they show up -- those will just pick up
// the change the next time they refetch. my-profile and group-members
// (visible live on the same Settings page as these controls) are worth
// refreshing immediately.
function invalidateProfileConsumers(queryClient: ReturnType<typeof useQueryClient>, userId?: string) {
  queryClient.invalidateQueries({ queryKey: ['my-profile', userId] })
  queryClient.invalidateQueries({ queryKey: ['group-members'] })
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (displayName: string) => {
      if (!user) throw new Error('Not signed in')
      const trimmed = displayName.trim()
      if (!trimmed) throw new Error('Display name can\'t be empty.')

      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', user.id)

      if (error) throw error
      return trimmed
    },
    onSuccess: () => invalidateProfileConsumers(queryClient, user?.id),
  })
}

// One-way flip -- once seen, there's no need to un-set it. Settings'
// "Replay tutorial" button starts the tour directly and doesn't touch this
// flag, so replaying never un-marks a first-timer's account.
export function useMarkTutorialSeen() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not signed in')
      const { error } = await supabase
        .from('profiles')
        .update({ has_seen_tutorial: true })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => invalidateProfileConsumers(queryClient, user?.id),
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Not signed in')
      const resized = await resizeSquareForUpload(file)
      // Fixed filename per user (not a random one, unlike cover/comment
      // uploads) -- upsert overwrites it in place instead of accumulating
      // one orphaned file in storage per photo someone's ever tried.
      const path = `${user.id}/avatar.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, resized, { contentType: 'image/jpeg', upsert: true })
      if (uploadError) throw uploadError

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: path })
        .eq('id', user.id)
      if (updateError) throw updateError

      return path
    },
    onSuccess: () => invalidateProfileConsumers(queryClient, user?.id),
  })
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (currentPath: string) => {
      if (!user) throw new Error('Not signed in')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)
      if (updateError) throw updateError

      await supabase.storage.from('avatars').remove([currentPath])
    },
    onSuccess: () => invalidateProfileConsumers(queryClient, user?.id),
  })
}
