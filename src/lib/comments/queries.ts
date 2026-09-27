import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'

export function useComments(bookId: string) {
  return useQuery({
    queryKey: ['comments', bookId],
    queryFn: async () => {
      // RLS already restricts this to unlocked rows (or the caller's own).
      const { data, error } = await supabase
        .from('comments')
        .select('*, profiles(display_name), chapters(label, position)')
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

export function usePostComment(bookId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      chapterId: string
      body: string
      parentId?: string | null
    }) => {
      if (!user) throw new Error('Not signed in')

      const { data, error } = await supabase
        .from('comments')
        .insert({
          book_id: bookId,
          chapter_id: input.chapterId,
          body: input.body,
          parent_id: input.parentId ?? null,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', bookId] })
      queryClient.invalidateQueries({ queryKey: ['locked-comment-count', bookId] })
    },
  })
}
