import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'

export function useRatings(bookId: string) {
  return useQuery({
    queryKey: ['ratings', bookId],
    queryFn: async () => {
      // RLS already restricts this to the caller's own ratings, plus
      // everyone else's once the caller has full access (has finished).
      const { data, error } = await supabase
        .from('ratings')
        .select('*, profiles(display_name)')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

export function usePostRating(bookId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      stars: number
      review?: string | null
      isDnf: boolean
      isReread: boolean
    }) => {
      if (!user) throw new Error('Not signed in')

      const { data, error } = await supabase
        .from('ratings')
        .insert({
          book_id: bookId,
          user_id: user.id,
          stars: input.stars,
          review: input.review ?? null,
          is_dnf: input.isDnf,
          is_reread: input.isReread,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings', bookId] })
    },
  })
}

export function useUpdateRating(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: { ratingId: string; stars: number; review?: string | null }) => {
      const { error } = await supabase
        .from('ratings')
        .update({ stars: input.stars, review: input.review ?? null })
        .eq('id', input.ratingId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings', bookId] })
    },
  })
}

export function useDeleteRating(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ratingId: string) => {
      const { error } = await supabase.from('ratings').delete().eq('id', ratingId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings', bookId] })
    },
  })
}
