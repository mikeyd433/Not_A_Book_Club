import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useChapters, useMemberShelf } from '@/lib/books/queries'
import { useMemberActivity } from '@/lib/comments/queries'
import CoverThumb from '@/components/CoverThumb'
import ProgressBar from '@/components/ProgressBar'
import { SHELF_STATUS_LABELS, type ShelfStatus } from '@/types/domain'

const SORT_LABELS = {
  status: 'By status',
  title: 'Title (A-Z)',
  recent: 'Recently added',
} as const
type SortMode = keyof typeof SORT_LABELS

const ACTIVITY_RANGE_LABELS = {
  '7': 'Last 7 days',
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  all: 'All time',
} as const
type ActivityRange = keyof typeof ACTIVITY_RANGE_LABELS

function activityRangeDays(range: ActivityRange): number | null {
  return range === 'all' ? null : Number(range)
}

// Same display order as Home's STATUS_GROUPS, minus its 'none' group --
// every row here already has a real status (it's a shelf_entries row),
// unlike Home's book list, which also covers books nobody's shelved yet.
const STATUS_ORDER: ShelfStatus[] = [
  'reading',
  'paused',
  'want_to_read',
  'finished',
  'dnf',
  'read_before_joining',
]

// Shared by MemberProfile (viewing someone else) and Profile (viewing your
// own) -- both pages are just this shelf-and-activity view with a
// different header above it, so the view itself lives here once instead
// of twice.
export default function ProfileActivity({ userId }: { userId: string }) {
  const { data: shelf } = useMemberShelf(userId)
  const [sortMode, setSortMode] = useState<SortMode>('status')
  const [activityRange, setActivityRange] = useState<ActivityRange>('30')
  const { data: activity } = useMemberActivity(userId, activityRangeDays(activityRange))

  const sortedShelf = useMemo(() => {
    if (!shelf) return []
    if (sortMode === 'title') {
      return [...shelf].sort((a, b) =>
        (a.books?.title ?? '').localeCompare(b.books?.title ?? ''),
      )
    }
    if (sortMode === 'recent') {
      return [...shelf].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }
    return shelf
  }, [shelf, sortMode])

  // Most-recently-active book first -- activity itself is already ordered
  // newest-first (useMemberActivity), so the first comment seen for each
  // book_id is also that book's most recent one.
  const activityByBook = useMemo(() => {
    if (!activity) return []
    const order: string[] = []
    const groups = new Map<string, { bookTitle: string; comments: typeof activity }>()
    for (const c of activity) {
      const existing = groups.get(c.book_id)
      if (existing) {
        existing.comments.push(c)
      } else {
        groups.set(c.book_id, { bookTitle: c.books?.title ?? 'Untitled', comments: [c] })
        order.push(c.book_id)
      }
    }
    return order.map((bookId) => ({ bookId, ...groups.get(bookId)! }))
  }, [activity])

  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(new Set())
  function toggleBook(bookId: string) {
    setExpandedBooks((prev) => {
      const next = new Set(prev)
      if (next.has(bookId)) next.delete(bookId)
      else next.add(bookId)
      return next
    })
  }

  return (
    <>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted">Shelf</h2>
          {shelf && shelf.length > 1 && (
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="min-h-9 rounded-lg border border-border bg-surface px-2 py-1 text-xs"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
        {shelf?.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No books on the shelf yet.</p>
        ) : sortMode === 'status' ? (
          STATUS_ORDER.map((status) => {
            const groupEntries = sortedShelf.filter((e) => e.status === status)
            if (groupEntries.length === 0) return null
            return (
              <div key={status} className="mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {SHELF_STATUS_LABELS[status]}
                </h3>
                <div className="mt-2 space-y-2">
                  {groupEntries.map((entry) => <ShelfRow key={entry.book_id} entry={entry} />)}
                </div>
              </div>
            )
          })
        ) : (
          <div className="mt-2 space-y-2">
            {sortedShelf.map((entry) => <ShelfRow key={entry.book_id} entry={entry} />)}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted">Recent activity</h2>
          <select
            value={activityRange}
            onChange={(e) => setActivityRange(e.target.value as ActivityRange)}
            className="min-h-9 rounded-lg border border-border bg-surface px-2 py-1 text-xs"
          >
            {Object.entries(ACTIVITY_RANGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {activityByBook.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            {activityRange === 'all'
              ? 'No comments you can see yet.'
              : `No comments you can see in the ${ACTIVITY_RANGE_LABELS[activityRange].toLowerCase()}.`}
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {activityByBook.map((group) => {
              const isExpanded = expandedBooks.has(group.bookId)
              return (
                <div key={group.bookId} className="rounded-card bg-surface">
                  <button
                    onClick={() => toggleBook(group.bookId)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left"
                  >
                    <span className="truncate text-sm font-semibold">{group.bookTitle}</span>
                    <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-muted">
                      {group.comments.length} comment{group.comments.length === 1 ? '' : 's'}
                      <span>{isExpanded ? '▲' : '▼'}</span>
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="space-y-1.5 border-t border-border p-2">
                      {group.comments.map((c) => {
                        // PostgREST can't tell, from the FK alone, that this
                        // self-join always returns at most one row (each
                        // comment has only one parent) -- the generated type
                        // treats it as an array regardless.
                        const parent = Array.isArray(c.parent) ? c.parent[0] : c.parent
                        return (
                          <Link
                            key={c.id}
                            to={`/book/${c.book_id}/thread`}
                            className="block rounded-lg bg-surface-alt p-2 text-sm active:opacity-80"
                          >
                            {(c.chapters?.label || c.parent_id) && (
                              <p className="text-xs text-muted">
                                {c.chapters?.label}
                                {c.chapters?.label && c.parent_id && ' · '}
                                {c.parent_id &&
                                  `↩ Reply${
                                    parent?.profiles?.display_name
                                      ? ` to ${parent.profiles.display_name}`
                                      : ''
                                  }`}
                              </p>
                            )}
                            <p className="mt-0.5 line-clamp-2 break-words">{c.body}</p>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

function ShelfRow({
  entry,
}: {
  entry: {
    book_id: string
    status: string
    current_chapter_id: string | null
    books: {
      id: string
      title: string
      author: string | null
      open_library_cover_url: string | null
      default_cover: { storage_path: string } | null
    } | null
  }
}) {
  const { data: chapters } = useChapters(entry.book_id)
  // Rank (1-based), not raw position -- see the matching comment in Home.tsx.
  const currentChapter = chapters?.find((c) => c.id === entry.current_chapter_id)
  const currentRank = chapters
    ? chapters.findIndex((c) => c.id === entry.current_chapter_id) + 1
    : 0
  // See the matching comment in Home.tsx.
  const hasMeaningfulChapter =
    entry.status !== 'finished' && entry.status !== 'read_before_joining'

  if (!entry.books) return null

  return (
    <Link
      to={`/book/${entry.book_id}`}
      className="flex gap-3 rounded-card bg-surface p-3 active:bg-surface-alt"
    >
      <CoverThumb book={entry.books} className="w-12 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{entry.books.title}</p>
        <p className="mt-0.5 text-xs font-medium text-accent">
          {SHELF_STATUS_LABELS[entry.status as ShelfStatus]}
        </p>
        {hasMeaningfulChapter && (chapters?.length ?? 0) > 0 && (
          <div className="mt-1">
            <ProgressBar
              current={currentRank}
              total={chapters?.length ?? 0}
              currentLabel={currentChapter?.label}
            />
          </div>
        )}
      </div>
    </Link>
  )
}
