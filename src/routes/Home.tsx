import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  useChapters,
  useGroupBooks,
  useMyShelfEntry,
} from '@/lib/books/queries'
import { useAchievementsCatalog, useAchievementsFeed } from '@/lib/achievements/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import CoverThumb from '@/components/CoverThumb'
import ProgressBar from '@/components/ProgressBar'
import { SHELF_STATUS_LABELS, type ShelfStatus } from '@/types/domain'
import type { MyGroup } from '@/lib/group/useMyGroup'

export default function Home({ group }: { group: MyGroup }) {
  const { data: books, isLoading } = useGroupBooks(group.id)

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

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Your shelf</h1>
      <AchievementsStrip />
      {books.map((book) => (
        <BookRow key={book.id} book={book} />
      ))}
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
