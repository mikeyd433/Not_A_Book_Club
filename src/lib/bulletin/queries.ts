import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'
import { resizeForUpload } from '@/lib/image'

export function usePosts(groupId: string) {
  return useQuery({
    queryKey: ['bulletin-posts', groupId],
    queryFn: async () => {
      // RLS already restricts this to unflagged rows (or the caller's own /
      // anything they can moderate as admin) -- same visibility rule as
      // group_posts' SELECT policy.
      const { data, error } = await supabase
        .from('group_posts')
        .select(
          '*, profiles!group_posts_user_id_fkey(display_name, avatar_url, avatar_updated_at), group_post_reactions(user_id, emoji), group_post_attachments(id, storage_path, gif_url)',
        )
        .eq('group_id', groupId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
  })
}

export function usePostToBulletin(groupId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      body: string
      parentId?: string | null
      photo?: File | null
      gifUrl?: string | null
    }) => {
      if (!user) throw new Error('Not signed in')

      const { data: post, error } = await supabase
        .from('group_posts')
        .insert({
          group_id: groupId,
          body: input.body,
          parent_id: input.parentId ?? null,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error

      if (input.photo) {
        const resized = await resizeForUpload(input.photo)
        const path = `${post.id}/${crypto.randomUUID()}.jpg`

        const { error: uploadError } = await supabase.storage
          .from('bulletin-attachments')
          .upload(path, resized, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError

        const { error: attachError } = await supabase
          .from('group_post_attachments')
          .insert({ post_id: post.id, storage_path: path })
        if (attachError) throw attachError
      } else if (input.gifUrl) {
        const { error: attachError } = await supabase
          .from('group_post_attachments')
          .insert({ post_id: post.id, gif_url: input.gifUrl })
        if (attachError) throw attachError
      }

      return post
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin-posts', groupId] })
    },
  })
}

export function useDeletePost(groupId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('group_posts').delete().eq('id', postId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin-posts', groupId] })
    },
  })
}

// Same RPC reasoning as flag_comment/resolve_comment_flag: flagging is
// designed to remove the flagger's own visibility, which a plain
// RLS-guarded UPDATE can never allow since Postgres requires the row stay
// SELECT-visible to whoever just wrote it.
export function useFlagPost(groupId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.rpc('flag_post', { p_post_id: postId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin-posts', groupId] })
    },
  })
}

export function useResolvePostFlag(groupId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.rpc('resolve_post_flag', { p_post_id: postId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin-posts', groupId] })
    },
  })
}

export function useTogglePostReaction(groupId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: { postId: string; emoji: string; reacted: boolean }) => {
      if (!user) throw new Error('Not signed in')

      if (input.reacted) {
        const { error } = await supabase
          .from('group_post_reactions')
          .delete()
          .eq('post_id', input.postId)
          .eq('user_id', user.id)
          .eq('emoji', input.emoji)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('group_post_reactions')
          .insert({ post_id: input.postId, user_id: user.id, emoji: input.emoji })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulletin-posts', groupId] })
    },
  })
}
