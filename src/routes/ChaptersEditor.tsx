import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  useAddChapters,
  useChapters,
  useDeleteChapter,
  useMyShelfEntry,
  useUpdateChapter,
} from '@/lib/books/queries'
import type { MyGroup } from '@/lib/group/useMyGroup'
import type { Json, Tables } from '@/types/database'

type Chapter = Tables<'chapters'>

export default function ChaptersEditor({ group: _group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: chapters } = useChapters(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const addChapters = useAddChapters(bookId!)
  const updateChapter = useUpdateChapter(bookId!)
  const deleteChapter = useDeleteChapter(bookId!)

  const canEdit = myEntry?.status === 'reading' || myEntry?.status === 'paused'

  const [quickFillCount, setQuickFillCount] = useState(10)
  const [bulkText, setBulkText] = useState('')
  const [showHistory, setShowHistory] = useState(false)

  const nextPosition = (chapters?.[chapters.length - 1]?.position ?? 0) + 1

  async function snapshot() {
    if (!user || !chapters) return
    await supabase.from('chapter_edits').insert({
      book_id: bookId!,
      user_id: user.id,
      snapshot: chapters as unknown as Json,
    })
  }

  async function handleQuickFill() {
    await snapshot()
    const start = nextPosition
    await addChapters.mutateAsync(
      Array.from({ length: quickFillCount }, (_, i) => ({
        position: start + i,
        label: `Chapter ${start + i}`,
      })),
    )
  }

  async function handleBulkPaste() {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    await snapshot()
    const start = nextPosition
    await addChapters.mutateAsync(
      lines.map((label, i) => ({ position: start + i, label })),
    )
    setBulkText('')
  }

  async function handleInsertBefore(chapter: Chapter) {
    if (!chapters) return
    const label = window.prompt(`Insert a new chapter before "${chapter.label}":`)
    if (!label) return
    await snapshot()

    const idx = chapters.findIndex((c) => c.id === chapter.id)
    const toShift = chapters.slice(idx)
    for (let i = toShift.length - 1; i >= 0; i--) {
      await supabase
        .from('chapters')
        .update({ position: toShift[i].position + 1 })
        .eq('id', toShift[i].id)
    }
    await supabase
      .from('chapters')
      .insert({ book_id: bookId!, position: chapter.position, label })

    queryClient.invalidateQueries({ queryKey: ['chapters', bookId] })
  }

  async function handleRename(chapter: Chapter) {
    const label = window.prompt('Chapter label', chapter.label)
    if (!label || label === chapter.label) return
    await snapshot()
    updateChapter.mutate({ id: chapter.id, label, part_label: chapter.part_label })
  }

  async function handleDelete(chapter: Chapter) {
    if (!window.confirm(`Remove "${chapter.label}"? Comments tagged to it go too.`))
      return
    await snapshot()
    deleteChapter.mutate(chapter.id)
  }

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">Chapters</h1>

      {!canEdit && (
        <p className="rounded-lg bg-surface-alt p-3 text-xs text-muted">
          Only members currently reading this book can edit its chapter list.
        </p>
      )}

      <ul className="space-y-1">
        {chapters?.map((chapter) => (
          <li
            key={chapter.id}
            className="flex items-center justify-between rounded-lg bg-surface px-3 py-2"
          >
            <div>
              {chapter.part_label && (
                <p className="text-xs uppercase text-muted">{chapter.part_label}</p>
              )}
              <p className="text-sm">{chapter.label}</p>
            </div>
            {canEdit && (
              <div className="flex gap-2 text-xs text-muted">
                <button onClick={() => handleInsertBefore(chapter)}>
                  Insert before
                </button>
                <button onClick={() => handleRename(chapter)}>Rename</button>
                <button
                  onClick={() => handleDelete(chapter)}
                  className="text-red-600"
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <>
          <div className="rounded-card bg-surface p-3">
            <p className="text-sm font-semibold">Quick fill</p>
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min={1}
                value={quickFillCount}
                onChange={(e) => setQuickFillCount(Number(e.target.value))}
                className="w-20 rounded-lg border border-border px-2 py-1 text-sm"
              />
              <button
                onClick={handleQuickFill}
                className="rounded-lg bg-accent px-3 py-1 text-sm font-semibold text-accent-contrast"
              >
                Add {quickFillCount} chapters
              </button>
            </div>
          </div>

          <div className="rounded-card bg-surface p-3">
            <p className="text-sm font-semibold">Bulk paste table of contents</p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={'One chapter label per line, e.g.\nPrologue\nChapter 1\nChapter 2'}
              className="mt-2 h-28 w-full rounded-lg border border-border p-2 text-sm"
            />
            <button
              onClick={handleBulkPaste}
              className="mt-2 rounded-lg bg-accent px-3 py-1 text-sm font-semibold text-accent-contrast"
            >
              Append pasted chapters
            </button>
          </div>
        </>
      )}

      <button
        onClick={() => setShowHistory((s) => !s)}
        className="text-xs text-muted underline"
      >
        {showHistory ? 'Hide' : 'Show'} edit history
      </button>
      {showHistory && <ChapterEditHistory bookId={bookId!} canEdit={Boolean(canEdit)} />}
    </div>
  )
}

function ChapterEditHistory({
  bookId,
  canEdit,
}: {
  bookId: string
  canEdit: boolean
}) {
  const queryClient = useQueryClient()
  const { data: edits } = useQuery({
    queryKey: ['chapter-edits', bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chapter_edits')
        .select('*, profiles(display_name)')
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  async function revert(snapshot: Chapter[]) {
    if (!window.confirm('Revert the chapter list to this point?')) return

    const { data: current, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', bookId)
    if (error) throw error

    const currentIds = new Set((current ?? []).map((c) => c.id))
    const snapshotIds = new Set(snapshot.map((s) => s.id))

    const toDelete = (current ?? []).filter((c) => !snapshotIds.has(c.id))
    const toRevive = snapshot.filter((s) => !currentIds.has(s.id))
    const toUpdate = snapshot.filter((s) => currentIds.has(s.id))

    if (toDelete.length) {
      await supabase.from('chapters').delete().in('id', toDelete.map((c) => c.id))
    }
    for (const s of toUpdate) {
      await supabase.from('chapters').update({ position: s.position + 1_000_000 }).eq('id', s.id)
    }
    for (const s of toUpdate) {
      await supabase
        .from('chapters')
        .update({ position: s.position, label: s.label, part_label: s.part_label })
        .eq('id', s.id)
    }
    if (toRevive.length) {
      await supabase.from('chapters').insert(
        toRevive.map((s) => ({
          id: s.id,
          book_id: bookId,
          position: s.position,
          label: s.label,
          part_label: s.part_label,
        })),
      )
    }

    queryClient.invalidateQueries({ queryKey: ['chapters', bookId] })
  }

  if (!edits || edits.length === 0) {
    return <p className="text-xs text-muted">No edits yet.</p>
  }

  return (
    <ul className="space-y-2">
      {edits.map((edit) => (
        <li key={edit.id} className="rounded-lg bg-surface-alt p-3 text-xs">
          <p>
            {edit.profiles?.display_name ?? 'Someone'} edited the
            chapter list · {new Date(edit.created_at).toLocaleString()}
          </p>
          {canEdit && (
            <button
              onClick={() => revert(edit.snapshot as unknown as Chapter[])}
              className="mt-1 text-accent underline"
            >
              Revert to this version
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
