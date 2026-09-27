import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { ShelfStatus, SortPref } from '@/types/domain'

export function coverPublicUrl(storagePath: string) {
  return supabase.storage.from('covers').getPublicUrl(storagePath).data
    .publicUrl
}

// === books ===================================================================

export function useGroupBooks(groupId: string) {
  return useQuery({
    queryKey: ['books', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('books')
        .select(
          '*, default_cover:covers!books_default_cover_id_fkey(storage_path)',
        )
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
  })
}

export function useBook(bookId: string) {
  return useQuery({
    queryKey: ['book', bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('books')
        .select(
          '*, default_cover:covers!books_default_cover_id_fkey(storage_path)',
        )
        .eq('id', bookId)
        .single()

      if (error) throw error
      return data
    },
  })
}

export function useAddBook(groupId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (book: {
      title: string
      author: string | null
      openLibraryId: string | null
      openLibraryCoverUrl: string | null
    }) => {
      if (!user) throw new Error('Not signed in')

      const { data, error } = await supabase
        .from('books')
        .insert({
          group_id: groupId,
          title: book.title,
          author: book.author,
          open_library_id: book.openLibraryId,
          open_library_cover_url: book.openLibraryCoverUrl,
          added_by: user.id,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books', groupId] })
    },
  })
}

// === chapters =================================================================

export function useChapters(bookId: string) {
  return useQuery({
    queryKey: ['chapters', bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', bookId)
        .order('position', { ascending: true })

      if (error) throw error
      return data
    },
  })
}

export function useAddChapters(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      chapters: { position: number; label: string; part_label?: string | null }[],
    ) => {
      const { error } = await supabase.from('chapters').insert(
        chapters.map((c) => ({ book_id: bookId, ...c })),
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', bookId] })
    },
  })
}

export function useUpdateChapter(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (chapter: { id: string; label: string; part_label?: string | null }) => {
      const { error } = await supabase
        .from('chapters')
        .update({ label: chapter.label, part_label: chapter.part_label })
        .eq('id', chapter.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', bookId] })
    },
  })
}

export function useDeleteChapter(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (chapterId: string) => {
      const { error } = await supabase.from('chapters').delete().eq('id', chapterId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chapters', bookId] })
    },
  })
}

// === shelf entries ============================================================

export function useMyShelfEntry(bookId: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['shelf-entry', bookId, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shelf_entries')
        .select(
          '*, personal_cover:covers!shelf_entries_personal_cover_id_fkey(storage_path)',
        )
        .eq('book_id', bookId)
        .eq('user_id', user!.id)
        .maybeSingle()

      if (error) throw error
      return data
    },
  })
}

export function useBookShelfEntries(bookId: string) {
  return useQuery({
    queryKey: ['shelf-entries', bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shelf_entries')
        .select('*, profiles(display_name)')
        .eq('book_id', bookId)

      if (error) throw error
      return data
    },
  })
}

export function useUpsertShelfEntry(bookId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (patch: {
      status?: ShelfStatus
      current_chapter_id?: string | null
      spoil_me?: boolean
      sort_pref?: SortPref
      muted?: boolean
      is_rereading?: boolean
    }) => {
      if (!user) throw new Error('Not signed in')

      const { data, error } = await supabase
        .from('shelf_entries')
        .upsert(
          { user_id: user.id, book_id: bookId, ...patch },
          { onConflict: 'user_id,book_id' },
        )
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelf-entry', bookId, user?.id] })
      queryClient.invalidateQueries({ queryKey: ['shelf-entries', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
    },
  })
}
