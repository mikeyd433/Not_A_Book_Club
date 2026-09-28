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
//
// Polls rather than being invalidated from every mutation that could
// trigger an award (posting a comment/rating/prediction, finishing a
// book, ...) -- simpler than wiring invalidation into each of those, and
// AchievementWatcher relies on this refetching promptly to notice a new
// achievement and celebrate it.
export function useAchievementsFeed() {
  return useQuery({
    queryKey: ['achievements-feed'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('achievements_feed')
      if (error) throw error
      return data
    },
    refetchInterval: 20_000,
  })
}
