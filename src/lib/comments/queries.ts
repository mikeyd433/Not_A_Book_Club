import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'
import { resizeForUpload } from '@/lib/image'

export function useComments(bookId: string) {
  return useQuery({
    queryKey: ['comments', bookId],
    queryFn: async () => {
      // RLS already restricts this to unlocked, unflagged rows (or the
      // caller's own / anything they can moderate as admin).
      const { data, error } = await supabase
        .from('comments')
        .select(
          '*, profiles(display_name), chapters(label, position), reactions(user_id, emoji), spoiler_blocks(id, ordinal, content), comment_attachments(id, storage_path, gif_url)',
        )
        .eq('book_id', bookId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
  })
}

export function useLockedCommentCount(bookId: string) {
  return useQuery({
    queryKey: ['locked-comment-count', bookId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('locked_comment_count', {
        p_book_id: bookId,
      })
      if (error) throw error
      return data ?? 0
    },
  })
}

export type PendingSpoilerBlock = {
  ordinal: number
  chapterId: string
  content: string
}

export function usePostComment(bookId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      chapterId: string
      body: string
      parentId?: string | null
      noSpoilers?: boolean
      spoilerBlocks?: PendingSpoilerBlock[]
      madeDuringReread?: boolean
      photo?: File | null
      gifUrl?: string | null
    }) => {
      if (!user) throw new Error('Not signed in')

      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          book_id: bookId,
          chapter_id: input.chapterId,
          body: input.body,
          parent_id: input.parentId ?? null,
          no_spoilers: input.noSpoilers ?? false,
          made_during_reread: input.madeDuringReread ?? false,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error

      if (input.spoilerBlocks && input.spoilerBlocks.length > 0) {
        const { error: blocksError } = await supabase
          .from('spoiler_blocks')
          .insert(
            input.spoilerBlocks.map((b) => ({
              comment_id: comment.id,
              book_id: bookId,
              chapter_id: b.chapterId,
              ordinal: b.ordinal,
              content: b.content,
            })),
          )
        if (blocksError) throw blocksError
      }

      if (input.photo) {
        const resized = await resizeForUpload(input.photo)
        const path = `${comment.id}/${crypto.randomUUID()}.jpg`

        const { error: uploadError } = await supabase.storage
          .from('comment-attachments')
          .upload(path, resized, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError

        const { error: attachError } = await supabase
          .from('comment_attachments')
          .insert({
            comment_id: comment.id,
            book_id: bookId,
            chapter_id: input.chapterId,
            storage_path: path,
          })
        if (attachError) throw attachError
      } else if (input.gifUrl) {
        const { error: attachError } = await supabase
          .from('comment_attachments')
          .insert({
            comment_id: comment.id,
            book_id: bookId,
            chapter_id: input.chapterId,
            gif_url: input.gifUrl,
          })
        if (attachError) throw attachError
      }

      return comment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', bookId] })
      queryClient.invalidateQueries({ queryKey: ['locked-comment-count', bookId] })
    },
  })
}

export function useDeleteComment(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from('comments').delete().eq('id', commentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', bookId] })
      queryClient.invalidateQueries({ queryKey: ['locked-comment-count', bookId] })
    },
  })
}

// Anyone can flag a comment they can see. It stays visible only to its
// author and admins from then on, until one of them resolves it.
//
// This goes through an RPC rather than a plain RLS-guarded update: Postgres
// requires the row still be SELECT-visible to whoever just wrote it, but
// flagging is specifically designed to remove the flagger's own visibility
// (unless they're the author/admin) -- so a normal UPDATE policy can never
// allow this. flag_comment() runs as SECURITY DEFINER and checks
// authorization itself instead.
export function useFlagComment(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.rpc('flag_comment', {
        p_comment_id: commentId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', bookId] })
      queryClient.invalidateQueries({ queryKey: ['locked-comment-count', bookId] })
    },
  })
}

// The poster or an admin resolves a flag by retagging (if the chapter was
// wrong) and/or just clearing it. Same RPC reasoning as flag_comment above.
export function useResolveFlag(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { commentId: string; chapterId?: string }) => {
      const { error } = await supabase.rpc('resolve_comment_flag', {
        p_comment_id: input.commentId,
        p_new_chapter_id: input.chapterId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', bookId] })
      queryClient.invalidateQueries({ queryKey: ['locked-comment-count', bookId] })
    },
  })
}

export function useToggleReaction(bookId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      commentId: string
      emoji: string
      reacted: boolean
    }) => {
      if (!user) throw new Error('Not signed in')

      if (input.reacted) {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('comment_id', input.commentId)
          .eq('user_id', user.id)
          .eq('emoji', input.emoji)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('reactions')
          .insert({ comment_id: input.commentId, user_id: user.id, emoji: input.emoji })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', bookId] })
    },
  })
}
