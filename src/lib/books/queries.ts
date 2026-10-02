import { useMemo } from 'react'
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

// The spoiler-gate rule for the whole app: whether this member can see a
// book's full, unlocked content rather than just up to their current
// chapter. Previously reimplemented independently in Thread, Reviews and
// PredictionsPanel -- a single source of truth for a rule this central is
// worth the shared hook, since a tweak here used to mean finding and
// updating three separate copies.
export function useFullAccess(bookId: string): boolean {
  const { data: myEntry } = useMyShelfEntry(bookId)

  return Boolean(
    myEntry &&
      (myEntry.status === 'read_before_joining' ||
        (myEntry.status === 'finished' && (!myEntry.is_rereading || myEntry.spoil_me)) ||
        (myEntry.status === 'dnf' && myEntry.spoil_me)),
  )
}

export type ChapterOption = { id: string; label: string; position: number }

// Which chapters this member is currently allowed to tag a comment or
// prediction to: every chapter once they have full access, otherwise only
// up to their current reading position.
export function useTaggableChapters(bookId: string): ChapterOption[] {
  const { data: chapters } = useChapters(bookId)
  const { data: myEntry } = useMyShelfEntry(bookId)
  const fullAccess = useFullAccess(bookId)

  return useMemo(() => {
    if (!chapters || !myEntry) return []
    if (fullAccess) return chapters

    const currentPosition = chapters.find(
      (c) => c.id === myEntry.current_chapter_id,
    )?.position
    if (currentPosition === undefined) return []
    return chapters.filter((c) => c.position <= currentPosition)
  }, [chapters, myEntry, fullAccess])
}

// Admin-only. Deleting the book row cascades through chapters, comments,
// ratings, predictions, shelf_entries, etc. server-side (FK ON DELETE
// CASCADE) -- covers row deletion cascades too, but their files in Storage
// don't disappear just because the DB row referencing them does, so those
// are removed here as a best-effort client-side step, same as
// useDeleteCover already does for a single cover.
export function useDeleteBook(groupId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (bookId: string) => {
      const { data: covers, error: coversError } = await supabase
        .from('covers')
        .select('storage_path')
        .eq('book_id', bookId)
      if (coversError) throw coversError

      const { error: deleteError } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId)
      if (deleteError) throw deleteError

      if (covers && covers.length > 0) {
        await supabase.storage
          .from('covers')
          .remove(covers.map((c) => c.storage_path))
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books', groupId] })
    },
  })
}

export const RESET_CATEGORIES = [
  'chapters',
  'discussion',
  'progress',
  'ratings',
  'predictions',
  'covers',
  'achievements',
] as const

export type ResetCategory = (typeof RESET_CATEGORIES)[number]

// Admin-only. Wipes selected categories of a book's data via the
// reset_book_data() RPC (which also enforces the admin check server-side)
// without deleting the book row itself. Resetting chapters cascades
// discussion/predictions server-side too (comments and predictions are
// tagged to chapters), which is why covers/attachments storage paths have
// to be read out *before* calling the RPC -- the rows naming them are
// gone the moment it returns.
export function useResetBookData(bookId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (categories: Set<ResetCategory>) => {
      const needsCoverCleanup = categories.has('covers')
      const needsAttachmentCleanup =
        categories.has('chapters') || categories.has('discussion')

      const [coverPaths, attachmentPaths] = await Promise.all([
        needsCoverCleanup
          ? supabase
              .from('covers')
              .select('storage_path')
              .eq('book_id', bookId)
              .then(({ data, error }) => {
                if (error) throw error
                return (data ?? []).map((c) => c.storage_path)
              })
          : Promise.resolve([] as string[]),
        needsAttachmentCleanup
          ? supabase
              .from('comment_attachments')
              .select('storage_path')
              .eq('book_id', bookId)
              .not('storage_path', 'is', null)
              .then(({ data, error }) => {
                if (error) throw error
                return (data ?? [])
                  .map((a) => a.storage_path)
                  .filter((p): p is string => Boolean(p))
              })
          : Promise.resolve([] as string[]),
      ])

      const { error } = await supabase.rpc('reset_book_data', {
        p_book_id: bookId,
        p_chapters: categories.has('chapters'),
        p_discussion: categories.has('discussion'),
        p_progress: categories.has('progress'),
        p_ratings: categories.has('ratings'),
        p_predictions: categories.has('predictions'),
        p_covers: categories.has('covers'),
        p_achievements: categories.has('achievements'),
      })
      if (error) throw error

      await Promise.all([
        coverPaths.length > 0
          ? supabase.storage.from('covers').remove(coverPaths)
          : Promise.resolve(),
        attachmentPaths.length > 0
          ? supabase.storage.from('comment-attachments').remove(attachmentPaths)
          : Promise.resolve(),
      ])
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
      queryClient.invalidateQueries({ queryKey: ['books'] })
      queryClient.invalidateQueries({ queryKey: ['chapters', bookId] })
      queryClient.invalidateQueries({ queryKey: ['shelf-entry', bookId] })
      queryClient.invalidateQueries({ queryKey: ['shelf-entries', bookId] })
      queryClient.invalidateQueries({ queryKey: ['comments', bookId] })
      queryClient.invalidateQueries({ queryKey: ['locked-comment-count', bookId] })
      queryClient.invalidateQueries({ queryKey: ['ratings', bookId] })
      queryClient.invalidateQueries({ queryKey: ['predictions', bookId] })
      queryClient.invalidateQueries({ queryKey: ['prediction-scoreboard', bookId] })
      queryClient.invalidateQueries({ queryKey: ['covers', bookId] })
      queryClient.invalidateQueries({ queryKey: ['achievements-feed'] })
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
      // A patch here can change full-access status (e.g. starting a reread
      // re-locks the thread), so anything gated by chapter position needs
      // to be refetched too -- otherwise a still-fresh cached query can
      // keep serving comments/predictions/ratings from before the lock
      // changed, for as long as its staleTime window lasts.
      queryClient.invalidateQueries({ queryKey: ['comments', bookId] })
      queryClient.invalidateQueries({ queryKey: ['locked-comment-count', bookId] })
      queryClient.invalidateQueries({ queryKey: ['predictions', bookId] })
      queryClient.invalidateQueries({ queryKey: ['prediction-scoreboard', bookId] })
      queryClient.invalidateQueries({ queryKey: ['ratings', bookId] })
    },
  })
}
