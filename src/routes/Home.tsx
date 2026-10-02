import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  useChapters,
  useGroupBooks,
  useMyShelfEntry,
  useMyShelfStatuses,
} from '@/lib/books/queries'
import { useAchievementsCatalog, useAchievementsFeed } from '@/lib/achievements/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import CoverThumb from '@/components/CoverThumb'
import ProgressBar from '@/components/ProgressBar'
import { SHELF_STATUS_LABELS, type ShelfStatus } from '@/types/domain'
import type { MyGroup } from '@/lib/group/useMyGroup'

type GroupBook = {
  id: string
  title: string
  author: string | null
  open_library_cover_url: string | null
  default_cover: { storage_path: string } | null
  created_at: string
}

const SORT_LABELS = {
  status: 'By status',
  title: 'Title (A-Z)',
  recent: 'Recently added',
} as const
type SortMode = keyof typeof SORT_LABELS

// "none" covers a book nobody's added to their shelf yet -- shown last,
// since it's the least relevant group day-to-day and mainly a prompt to
// pick a status at all.
const STATUS_GROUPS: (ShelfStatus | 'none')[] = [
  'reading',
  'paused',
  'want_to_read',
  'finished',
  'dnf',
  'read_before_joining',
  'none',
]
const STATUS_GROUP_LABELS: Record<ShelfStatus | 'none', string> = {
  ...SHELF_STATUS_LABELS,
  none: 'Not on your shelf',
}

export default function Home({ group }: { group: MyGroup }) {
  const { data: books, isLoading } = useGroupBooks(group.id)
  const [sortMode, setSortMode] = useState<SortMode>('status')

  const bookIds = useMemo(() => (books ?? []).map((b) => b.id), [books])
  const { data: myStatuses } = useMyShelfStatuses(bookIds)
  const statusByBook = useMemo(() => {
    const map = new Map<string, ShelfStatus>()
    myStatuses?.forEach((e) => map.set(e.book_id, e.status as ShelfStatus))
    return map
  }, [myStatuses])

  if (isLoading) return <p className="text-sm text-muted">Loading…</p>

  if (!books || books.length === 0) {
    return (
      <div className="rounded-card bg-surface p-6 text-center">
        <p className="text-sm text-muted">No books yet.</p>
        <Link
          to="/add-book"
          className="mt-2 inline-block min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-accent active:bg-surface-alt"
        >
          Add your first book
        </Link>
      </div>
    )
  }

  const flatBooks = [...books]
  if (sortMode === 'title') {
    flatBooks.sort((a, b) => a.title.localeCompare(b.title))
  }
  // 'recent' needs no extra sort -- useGroupBooks already orders by
  // created_at descending.

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold">Your shelf</h1>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="min-h-11 rounded-lg border border-border bg-surface px-2 py-2 text-sm"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <AchievementsStrip />

      {sortMode === 'status'
        ? STATUS_GROUPS.map((status) => {
            const groupBooks = (books as GroupBook[]).filter(
              (b) => (statusByBook.get(b.id) ?? 'none') === status,
            )
            if (groupBooks.length === 0) return null
            return (
              <div key={status} className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {STATUS_GROUP_LABELS[status]}
                </h2>
                <div className="space-y-2">
                  {groupBooks.map((book) => (
                    <BookRow key={book.id} book={book} />
                  ))}
                </div>
              </div>
            )
          })
        : flatBooks.map((book) => <BookRow key={book.id} book={book} />)}
    </div>
  )
}

// Achievements no longer gets a permanent bottom-nav tab -- it's a
// celebratory side feature, not something worth checking every visit --
// but a one-line summary here keeps it one tap away for anyone curious.
function AchievementsStrip() {
  const { user } = useAuth()
  const { data: catalog } = useAchievementsCatalog()
  const { data: feed } = useAchievementsFeed()

  const earnedCount = useMemo(
    () => new Set((feed ?? []).filter((f) => f.user_id === user?.id).map((f) => f.achievement_key)).size,
    [feed, user?.id],
  )

  if (!catalog) return null

  return (
    <Link
      to="/achievements"
      className="flex min-h-11 items-center justify-between rounded-card bg-surface px-3 py-2 text-sm active:bg-surface-alt"
    >
      <span className="font-medium">🏆 Achievements</span>
      <span className="text-muted">
        {earnedCount} / {catalog.length} earned →
      </span>
    </Link>
  )
}

function BookRow({
  book,
}: {
  book: {
    id: string
    title: string
    author: string | null
    open_library_cover_url: string | null
    default_cover: { storage_path: string } | null
  }
}) {
  const { data: chapters } = useChapters(book.id)
  const { data: entry } = useMyShelfEntry(book.id)
  const { data: activity } = useUnlockedCommentActivity(book.id)

  const currentPosition = chapters?.find(
    (c) => c.id === entry?.current_chapter_id,
  )?.position

  return (
    <Link
      to={`/book/${book.id}/thread`}
      className="flex gap-3 rounded-card bg-surface p-3"
    >
      <CoverThumb
        book={book}
        personalCoverPath={entry?.personal_cover?.storage_path}
        className="w-14 flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{book.title}</p>
        <p className="truncate text-xs text-muted">{book.author}</p>
        <p className="mt-1 text-xs font-medium text-accent">
          {entry ? SHELF_STATUS_LABELS[entry.status as ShelfStatus] : 'Not on your shelf'}
        </p>
        {entry && (chapters?.length ?? 0) > 0 && (
          <div className="mt-1">
            <ProgressBar
              current={currentPosition ?? 0}
              total={chapters?.length ?? 0}
            />
          </div>
        )}
        {activity && activity.count > 0 && (
          <p className="mt-1 text-xs text-muted">
            💬 {activity.count} unlocked comment{activity.count === 1 ? '' : 's'}
            {activity.lastAt && ` · ${formatRelativeTime(activity.lastAt)}`}
          </p>
        )}
      </div>
    </Link>
  )
}

function useUnlockedCommentActivity(bookId: string) {
  return useQuery({
    queryKey: ['unlocked-comment-activity', bookId],
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('comments')
        .select('created_at', { count: 'exact' })
        .eq('book_id', bookId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error
      return { count: count ?? 0, lastAt: data?.[0]?.created_at ?? null }
    },
  })
}

function formatRelativeTime(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(isoTimestamp).toLocaleDateString()
}
