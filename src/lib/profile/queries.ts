import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'

export function useMyProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-profile', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user!.id)
        .single()

      if (error) throw error
      return data
    },
  })
}

// display_name is embedded by its own select('profiles(display_name)') in
// a lot of places (comments, group members, ratings, ...) rather than one
// shared query, so there's no single cache key to invalidate everywhere it
// shows up -- those will just pick up the change the next time they
// refetch. my-profile and group-members (visible live on the same
// Settings page as this control) are worth refreshing immediately.
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['group-members'] })
    },
  })
}
