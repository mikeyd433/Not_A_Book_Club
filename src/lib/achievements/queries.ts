import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useAchievementsCatalog() {
  return useQuery({
    queryKey: ['achievements-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('achievements').select('*')
      if (error) throw error
      return data
    },
  })
}

// RLS-masked per viewer: book_id/book_title come back null for a
// book-tied achievement until the viewer has full access to that book.
// Restricted to the caller's shared groups server-side, not just the UI.
export function useAchievementsFeed() {
  return useQuery({
    queryKey: ['achievements-feed'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('achievements_feed')
      if (error) throw error
      return data
    },
  })
}
