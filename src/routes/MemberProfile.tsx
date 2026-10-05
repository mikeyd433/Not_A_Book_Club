import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useChapters, useMemberShelf } from '@/lib/books/queries'
import { useMemberActivity } from '@/lib/comments/queries'
import { useMemberProfile } from '@/lib/profile/queries'
import { useAchievementsCatalog, useAchievementsFeed } from '@/lib/achievements/queries'
import Avatar from '@/components/Avatar'
import CoverThumb from '@/components/CoverThumb'
import ProgressBar from '@/components/ProgressBar'
import QueryError from '@/components/QueryError'
import { SHELF_STATUS_LABELS, type ShelfStatus } from '@/types/domain'

export default function MemberProfile() {
  const { userId } = useParams<{ userId: string }>()
  const { data: profile, isError, error, refetch } = useMemberProfile(userId!)
  const { data: shelf } = useMemberShelf(userId!)
  const { data: activity } = useMemberActivity(userId!)
  const { data: catalog } = useAchievementsCatalog()
  const { data: feed } = useAchievementsFeed()

  const earned = useMemo(() => {
    const earnedKeys = new Set(
      (feed ?? []).filter((f) => f.user_id === userId).map((f) => f.achievement_key),
    )
    return (catalog ?? []).filter((a) => earnedKeys.has(a.key))
  }, [catalog, feed, userId])

  if (isError) return <QueryError error={error} onRetry={() => refetch()} />
  if (!profile) return <p className="text-sm text-muted">Loading…</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar path={profile.avatar_url} name={profile.display_name} size={56} />
        <h1 className="text-lg font-bold">{profile.display_name}</h1>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted">
          🏆 Achievements ({earned.length}/{catalog?.length ?? 0})
        </h2>
        {earned.length === 0 ? (
          <p className="mt-2 text-xs text-muted">None yet.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {earned.map((a) => (
              <span
                key={a.key}
                title={a.description}
                className="rounded-full bg-surface-alt px-3 py-1.5 text-xs font-medium"
              >
                🏆 {a.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted">Shelf</h2>
        {shelf?.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No books on their shelf yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {shelf?.map((entry) => <MemberShelfRow key={entry.book_id} entry={entry} />)}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted">Recent activity</h2>
        {activity?.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No comments you can see yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {activity?.map((c) => (
              <Link
                key={c.id}
                to={`/book/${c.book_id}/thread`}
                className="block rounded-card bg-surface p-3 text-sm active:bg-surface-alt"
              >
                <p className="text-xs text-muted">
                  {c.books?.title}
                  {c.chapters?.label && ` · ${c.chapters.label}`}
                </p>
                <p className="mt-1 line-clamp-2 break-words">{c.body}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MemberShelfRow({
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
        {(chapters?.length ?? 0) > 0 && (
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
