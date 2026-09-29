import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useBook,
  useBookShelfEntries,
  useChapters,
  useMyShelfEntry,
  useUpsertShelfEntry,
} from '@/lib/books/queries'
import CoverThumb from '@/components/CoverThumb'
import ChapterWheelPicker from '@/components/ChapterWheelPicker'
import { celebrate } from '@/lib/celebrate'
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

export default function BookDetail({ group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
  const { data: book } = useBook(bookId!)
  const { data: chapters } = useChapters(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const { data: everyone } = useBookShelfEntries(bookId!)
  const upsert = useUpsertShelfEntry(bookId!)
  const [showPicker, setShowPicker] = useState(false)

  if (!book) return <p className="text-sm text-muted">Loading…</p>

  const currentChapter = chapters?.find((c) => c.id === myEntry?.current_chapter_id)

  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <Link to={`/book/${book.id}/covers`} className="w-24 flex-shrink-0">
          <CoverThumb
            book={book}
            personalCoverPath={myEntry?.personal_cover?.storage_path}
          />
        </Link>
        <div className="min-w-0">
          <h1 className="break-words text-lg font-bold">{book.title}</h1>
          <p className="break-words text-sm text-muted">{book.author}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              to={`/book/${book.id}/covers`}
              className="min-h-9 rounded-full border border-border px-3 py-2 text-xs leading-tight"
            >
              Covers
            </Link>
            <Link
              to={`/book/${book.id}/chapters`}
              className="min-h-9 rounded-full border border-border px-3 py-2 text-xs leading-tight"
            >
              Chapters ({chapters?.length ?? 0})
            </Link>
            <Link
              to={`/book/${book.id}/thread`}
              className="min-h-9 rounded-full bg-accent px-3 py-2 text-xs leading-tight text-accent-contrast"
            >
              Discussion
            </Link>
            <Link
              to={`/book/${book.id}/reviews`}
              className="min-h-9 rounded-full border border-border px-3 py-2 text-xs leading-tight"
            >
              ⭐ Reviews
            </Link>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted">Your shelf</h2>
        <select
          value={myEntry?.status ?? ''}
          onChange={(e) => upsert.mutate({ status: e.target.value as ShelfStatus })}
          className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface px-2 py-2 text-base"
        >
          {!myEntry && <option value="" disabled>Not on your shelf</option>}
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {SHELF_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      {myEntry && (chapters?.length ?? 0) > 0 && (
        <div>
          <button
            onClick={() => setShowPicker((s) => !s)}
            className="flex w-full items-center justify-between rounded-card bg-surface p-3 text-left"
          >
            <span className="text-sm font-semibold">Current chapter</span>
            <span className="text-sm text-accent">
              {currentChapter?.label ?? 'Set position →'}
            </span>
          </button>
          {showPicker && (
            <div className="mt-2 rounded-card bg-surface p-2">
              <ChapterWheelPicker
                items={(chapters ?? []).map((c) => ({ id: c.id, label: c.label }))}
                value={myEntry.current_chapter_id}
                onChange={(chapterId) => {
                  const newPosition = chapters?.find((c) => c.id === chapterId)?.position
                  const oldPosition = currentChapter?.position
                  if (newPosition !== undefined && (oldPosition === undefined || newPosition > oldPosition)) {
                    celebrate()
                  }
                  upsert.mutate({ current_chapter_id: chapterId })
                }}
              />
            </div>
          )}
        </div>
      )}

      {myEntry && (
        <details className="rounded-card bg-surface p-3">
          <summary className="min-h-9 cursor-pointer text-sm font-semibold text-muted">
            More options
          </summary>
          <div className="mt-3 space-y-3">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={myEntry.muted}
                onChange={(e) => upsert.mutate({ muted: e.target.checked })}
                className="size-5"
              />
              🔕 Mute notifications for this book
            </label>

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
        </details>
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
              <li
                key={entry.user_id}
                className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm"
              >
                <span>{entry.profiles?.display_name ?? 'Someone'}</span>
                <span className="text-muted">
                  {entry.is_rereading ? '🔁 Rereading' : SHELF_STATUS_LABELS[entry.status as ShelfStatus]}
                  {pos ? ` · Ch. ${pos}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-xs text-muted">Group: {group.name}</p>
    </div>
  )
}
