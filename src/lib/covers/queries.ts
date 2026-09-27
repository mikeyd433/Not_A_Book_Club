import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'
import { coverPublicUrl } from '@/lib/books/queries'
import { computeAccentColor, loadImage } from '@/lib/image'

export function useCovers(bookId: string) {
  return useQuery({
    queryKey: ['covers', bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('covers')
        .select('*, profiles(display_name)')
        .eq('book_id', bookId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
  })
}

export function useUploadCover(bookId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (blob: Blob) => {
      if (!user) throw new Error('Not signed in')

      const path = `${bookId}/${crypto.randomUUID()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from('covers')
        .insert({ book_id: bookId, uploaded_by: user.id, storage_path: path })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['covers', bookId] })
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })
}

export function useDeleteCover(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (cover: { id: string; storage_path: string }) => {
      const { error: dbError } = await supabase
        .from('covers')
        .delete()
        .eq('id', cover.id)
      if (dbError) throw dbError

      // Best-effort: the row is gone either way, and RLS already guarded
      // who could reach this point.
      await supabase.storage.from('covers').remove([cover.storage_path])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['covers', bookId] })
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })
}

// Admin-only: promotes a gallery cover to the group default, and recomputes
// the book's accent color from it (the spec ties accent to "the displayed
// cover", which for everyone without a personal override is the default).
export function useSetDefaultCover(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (cover: { id: string; storage_path: string }) => {
      const { error: rpcError } = await supabase.rpc('set_default_cover', {
        p_book_id: bookId,
        p_cover_id: cover.id,
      })
      if (rpcError) throw rpcError

      const img = await loadImage(coverPublicUrl(cover.storage_path))
      const { accent } = await computeAccentColor(img)

      const { error: updateError } = await supabase
        .from('books')
        .update({ accent_color: accent })
        .eq('id', bookId)
      if (updateError) throw updateError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['covers', bookId] })
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })
}

// Personal override: pick any gallery cover for your own shelf, or clear it
// (null) to fall back to the group default again.
export function useSetPersonalCover(bookId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (coverId: string | null) => {
      if (!user) throw new Error('Not signed in')

      const { error } = await supabase
        .from('shelf_entries')
        .update({ personal_cover_id: coverId })
        .eq('user_id', user.id)
        .eq('book_id', bookId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelf-entry', bookId, user?.id] })
      queryClient.invalidateQueries({ queryKey: ['shelf-entries', bookId] })
    },
  })
}
