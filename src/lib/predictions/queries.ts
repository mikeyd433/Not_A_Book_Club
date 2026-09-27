import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'

export function usePredictions(bookId: string) {
  return useQuery({
    queryKey: ['predictions', bookId],
    queryFn: async () => {
      // RLS already restricts this to the caller's own predictions plus
      // anyone else's resolved-and-unlocked ones.
      const { data, error } = await supabase
        .from('predictions')
        .select('*, profiles(display_name), chapters(label, position)')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

export function usePostPrediction(bookId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: { chapterId: string; body: string }) => {
      if (!user) throw new Error('Not signed in')

      const { data, error } = await supabase
        .from('predictions')
        .insert({
          book_id: bookId,
          chapter_id: input.chapterId,
          body: input.body,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions', bookId] })
    },
  })
}

// Self-resolve: a plain owner-scoped UPDATE is enough here (no RPC needed,
// unlike comment flagging) since the author can always see their own
// prediction regardless of verdict. The guard trigger on the predictions
// table is what actually enforces "verdict can only be set once".
export function useResolvePrediction(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: {
      predictionId: string
      verdict: 'correct' | 'incorrect' | 'unclear'
    }) => {
      const { error } = await supabase
        .from('predictions')
        .update({ verdict: input.verdict })
        .eq('id', input.predictionId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions', bookId] })
      queryClient.invalidateQueries({ queryKey: ['prediction-scoreboard', bookId] })
    },
  })
}

export function useDeletePrediction(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (predictionId: string) => {
      const { error } = await supabase.from('predictions').delete().eq('id', predictionId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions', bookId] })
    },
  })
}

export type ScoreboardRow = {
  user_id: string
  display_name: string
  correct: number
  incorrect: number
  unclear: number
  total: number
}

// Empty for anyone without full access (not finished/etc.) -- enforced in
// the RPC itself, not just by hiding this in the UI.
export function usePredictionScoreboard(bookId: string) {
  return useQuery({
    queryKey: ['prediction-scoreboard', bookId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prediction_scoreboard', {
        p_book_id: bookId,
      })
      if (error) throw error
      return (data ?? []) as ScoreboardRow[]
    },
  })
}
