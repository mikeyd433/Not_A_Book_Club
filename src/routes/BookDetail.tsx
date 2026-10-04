import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  RESET_CATEGORIES,
  useAddChapterAndAdvance,
  useBook,
  useBookShelfEntries,
  useChapters,
  useDeleteBook,
  useMyShelfEntry,
  useResetBookData,
  useUpsertShelfEntry,
  type ResetCategory,
} from '@/lib/books/queries'
import ChapterWheelPicker from '@/components/ChapterWheelPicker'
import { celebrate } from '@/lib/celebrate'
import { confirmAdvance } from '@/lib/books/confirmAdvance'
import { SHELF_STATUS_LABELS, type ShelfStatus } from '@/types/domain'
import type { MyGroup } from '@/lib/group/useMyGroup'

const STATUSES: ShelfStatus[] = [
  'reading',
  'paused',
  'finished',
  'dnf',
  'read_before_joining',
  'want_to_read',
]

const RESET_CATEGORY_LABELS: Record<ResetCategory, string> = {
  chapters: 'Table of contents (chapters)',
  discussion: 'Discussion (comments & reactions)',
  progress: "Everyone's reading progress",
  ratings: 'Ratings & reviews',
  covers: 'Community covers',
  achievements: 'Achievements earned for this book',
}

export default function BookDetail({ group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const { data: book } = useBook(bookId!)
  const { data: chapters } = useChapters(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const { data: everyone } = useBookShelfEntries(bookId!)
  const upsert = useUpsertShelfEntry(bookId!)
  const deleteBook = useDeleteBook(group.id)
  const resetBookData = useResetBookData(bookId!)
  const addNextChapter = useAddChapterAndAdvance(bookId!)
  const [showPicker, setShowPicker] = useState(false)
  // Bumped on a cancelled advance to force the wheel picker to remount and
  // re-settle on the still-current chapter -- it snaps to wherever the user
  // scrolled before onChange ever runs, so left alone it would keep showing
  // the chapter they backed out of instead of reverting.
  const [pickerResetKey, setPickerResetKey] = useState(0)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [showDangerZone, setShowDangerZone] = useState(false)
  const [resetSelection, setResetSelection] = useState<Set<ResetCategory>>(new Set())
  const [addChapterError, setAddChapterError] = useState('')

  function handleDelete() {
    if (!book) return
    if (
      !window.confirm(
        `Permanently delete "${book.title}"? This removes every chapter, comment, rating, and cover for it — there's no undoing this.`,
      )
    ) {
      return
    }
    deleteBook.mutate(book.id, { onSuccess: () => navigate('/') })
  }

  function toggleResetCategory(category: ResetCategory) {
    setResetSelection((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  function handleReset() {
    if (!book || resetSelection.size === 0) return
    const labels = RESET_CATEGORIES.filter((c) => resetSelection.has(c)).map(
      (c) => RESET_CATEGORY_LABELS[c],
    )
    const cascadeNote = resetSelection.has('chapters')
      ? '\n\n(Resetting chapters also clears discussion, since comments are tagged to specific chapters.)'
      : ''
    if (
      !window.confirm(
        `Reset "${book.title}"'s ${labels.join(', ')}? This cannot be undone.${cascadeNote}`,
      )
    ) {
      return
    }
    resetBookData.mutate(resetSelection, {
      onSuccess: () => setResetSelection(new Set()),
    })
  }

  const currentChapter = chapters?.find((c) => c.id === myEntry?.current_chapter_id)

  function handleChapterPicked(chapterId: string) {
    const newChapter = chapters?.find((c) => c.id === chapterId)
    if (!newChapter) return
    const oldPosition = currentChapter?.position
    if (!confirmAdvance(chapters ?? [], oldPosition, newChapter)) {
      setPickerResetKey((k) => k + 1)
      return
    }
    if (oldPosition === undefined || newChapter.position > oldPosition) {
      celebrate()
    }
    upsert.mutate({ current_chapter_id: chapterId })
  }

  async function handleAddNextChapter() {
    if (
      myEntry?.status !== 'reading' &&
      myEntry?.status !== 'paused' &&
      myEntry?.status !== 'read_before_joining'
    ) {
      setAddChapterError(
        'Set your shelf status to "Reading now", "Paused", or "Read before joining" to add new chapters.',
      )
      return
    }
    const defaultLabel = `Chapter ${addNextChapter.nextPosition}`
    const input = window.prompt(
      'Name this chapter (leave blank to just number it):',
      defaultLabel,
    )
    if (input === null) return
    setAddChapterError('')
    try {
      await addNextChapter.addAndAdvance(input.trim() || defaultLabel)
      celebrate()
    } catch (err) {
      setAddChapterError(
        err instanceof Error ? err.message : 'Failed to add the chapter.',
      )
    }
  }

  return (
    <div className="space-y-5">
      <div data-tour="shelf-status">
        <h2 className="text-sm font-semibold text-muted">Your shelf</h2>
        {!myEntry ? (
          <div className="mt-2">
            <p className="text-xs text-muted">
              Add this book to your shelf to join in — probably{' '}
              <span className="font-semibold text-accent">Reading now</span>{' '}
              if you're starting it.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  onClick={() => upsert.mutate({ status })}
                  disabled={upsert.isPending}
                  className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60 ${
                    status === 'reading'
                      ? 'bg-accent text-accent-contrast'
                      : 'border border-border bg-surface text-muted'
                  }`}
                >
                  {SHELF_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <select
            value={myEntry.status}
            onChange={(e) => upsert.mutate({ status: e.target.value as ShelfStatus })}
            className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface px-2 py-2 text-base"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {SHELF_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        )}
      </div>

      {myEntry && (
        <div>
          {(chapters?.length ?? 0) > 0 && (
            <button
              onClick={() => setShowPicker((s) => !s)}
              data-tour="current-chapter"
              className="flex w-full items-center justify-between rounded-card bg-surface p-3 text-left"
            >
              <span className="text-sm font-semibold">Current chapter</span>
              <span className="text-sm text-accent">
                {currentChapter?.label ?? 'Set position →'}
              </span>
            </button>
          )}
          {showPicker && (chapters?.length ?? 0) > 0 && (
            <div className="mt-2 rounded-card bg-surface p-2">
              <ChapterWheelPicker
                key={pickerResetKey}
                items={(chapters ?? []).map((c) => ({ id: c.id, label: c.label }))}
                value={myEntry.current_chapter_id}
                onChange={handleChapterPicked}
              />
            </div>
          )}

          <button
            onClick={handleAddNextChapter}
            disabled={addNextChapter.isPending}
            data-tour="add-chapter-live"
            className={`flex min-h-11 w-full items-center justify-center rounded-card border border-dashed border-border px-3 py-2 text-sm font-semibold text-accent disabled:opacity-60 ${
              (chapters?.length ?? 0) > 0 ? 'mt-2' : ''
            }`}
          >
            {addNextChapter.isPending
              ? 'Adding…'
              : `+ Add chapter ${addNextChapter.nextPosition} as you go`}
          </button>
          {addChapterError && (
            <p className="mt-2 text-xs text-red-600">{addChapterError}</p>
          )}
        </div>
      )}

      {myEntry && (myEntry.status === 'finished' || myEntry.status === 'dnf' || myEntry.is_rereading) && (
        <div className="rounded-card bg-surface p-3" data-tour="spoil-reread">
          <button
            onClick={() => setShowMoreOptions((s) => !s)}
            data-tour="more-options-toggle"
            aria-expanded={showMoreOptions}
            className="flex min-h-9 w-full items-center justify-between text-left text-sm font-semibold text-muted"
          >
            More options
            <span>{showMoreOptions ? '▲' : '▼'}</span>
          </button>
          {showMoreOptions && (
            <div className="mt-3 space-y-3">
              {myEntry.status === 'finished' && (
                <div>
                  {myEntry.is_rereading ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">🔁 Rereading</span>
                      <button
                        onClick={() => upsert.mutate({ is_rereading: false })}
                        className="min-h-9 rounded-full border border-border px-3 py-2 text-xs font-medium leading-tight"
                      >
                        Finish reread
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        upsert.mutate({
                          is_rereading: true,
                          current_chapter_id: null,
                          spoil_me: false,
                        })
                      }
                      className="min-h-9 w-full rounded-full border border-border px-3 py-2 text-xs font-medium leading-tight"
                    >
                      🔁 Start a reread
                    </button>
                  )}
                </div>
              )}

              {(myEntry.status === 'dnf' || myEntry.is_rereading) && (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={myEntry.spoil_me}
                    onChange={(e) => upsert.mutate({ spoil_me: e.target.checked })}
                    className="size-5"
                  />
                  {myEntry.is_rereading
                    ? 'View full thread anyway — see comments ahead of your reread position'
                    : 'Spoil me — unlock full access anyway'}
                </label>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-muted">
          Everyone's progress
        </h2>
        <ul className="mt-2 space-y-1">
          {everyone?.map((entry) => {
            const pos = chapters?.find((c) => c.id === entry.current_chapter_id)
              ?.position
            return (
              <li key={entry.user_id}>
                <Link
                  to={`/member/${entry.user_id}`}
                  className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm active:bg-surface-alt"
                >
                  <span>{entry.profiles?.display_name ?? 'Someone'}</span>
                  <span className="text-muted">
                    {entry.is_rereading ? '🔁 Rereading' : SHELF_STATUS_LABELS[entry.status as ShelfStatus]}
                    {pos ? ` · Ch. ${pos}` : ''}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-xs text-muted">Group: {group.name}</p>

      {group.role === 'admin' && (
        <div className="rounded-card border border-red-200 bg-surface p-3">
          <button
            onClick={() => setShowDangerZone((s) => !s)}
            className="flex min-h-9 w-full items-center justify-between text-left text-sm font-semibold text-red-600"
          >
            Danger zone
            <span>{showDangerZone ? '▲' : '▼'}</span>
          </button>
          {showDangerZone && (
            <div className="mt-3 space-y-4">
              <div>
                <p className="text-sm font-semibold">Reset book data</p>
                <p className="mt-1 text-xs text-muted">
                  Wipe selected data for this book without deleting it — e.g.
                  to start a reread from a clean slate. The book, its title,
                  and its cover stay put.
                </p>
                <div className="mt-2 space-y-1">
                  {RESET_CATEGORIES.map((category) => {
                    const forcedByChapters =
                      category === 'discussion' && resetSelection.has('chapters')
                    return (
                      <label
                        key={category}
                        className="flex min-h-9 items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={resetSelection.has(category) || forcedByChapters}
                          disabled={forcedByChapters}
                          onChange={() => toggleResetCategory(category)}
                          className="size-5"
                        />
                        {RESET_CATEGORY_LABELS[category]}
                        {forcedByChapters && (
                          <span className="text-xs text-muted">
                            (included automatically)
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>
                {resetBookData.isError && (
                  <p className="mt-2 text-xs text-red-600">
                    {resetBookData.error instanceof Error
                      ? resetBookData.error.message
                      : 'Failed to reset — try again.'}
                  </p>
                )}
                <button
                  onClick={handleReset}
                  disabled={resetSelection.size === 0 || resetBookData.isPending}
                  className="mt-3 min-h-10 w-full rounded-lg border border-red-600 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-60"
                >
                  {resetBookData.isPending ? 'Resetting…' : 'Reset selected data'}
                </button>
              </div>

              <button
                onClick={handleDelete}
                disabled={!book || deleteBook.isPending}
                className="min-h-10 w-full rounded-lg border border-red-600 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-60"
              >
                {deleteBook.isPending ? 'Deleting…' : 'Delete this book'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
