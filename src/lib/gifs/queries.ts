import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type GifResult = {
  id: string
  previewUrl: string
  fullUrl: string
}

// Proxied through the search-gifs edge function so the Giphy API key never
// reaches the client -- see supabase/functions/search-gifs/index.ts.
export function useSearchGifs(query: string) {
  return useQuery({
    queryKey: ['gif-search', query],
    enabled: query.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ results: GifResult[] }>(
        'search-gifs',
        { body: { q: query.trim() } },
      )
      if (error) throw error
      return data?.results ?? []
    },
  })
}
