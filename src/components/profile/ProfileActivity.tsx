import { Link } from 'react-router-dom'
import { useChapters, useMemberShelf } from '@/lib/books/queries'
import { useMemberActivity } from '@/lib/comments/queries'
import CoverThumb from '@/components/CoverThumb'
import ProgressBar from '@/components/ProgressBar'
import { SHELF_STATUS_LABELS, type ShelfStatus } from '@/types/domain'

// Shared by MemberProfile (viewing someone else) and Profile (viewing your
// own) -- both pages are just this shelf-and-activity view with a
// different header above it, so the view itself lives here once instead
// of twice.
export default function ProfileActivity({ userId }: { userId: string }) {
  const { data: shelf } = useMemberShelf(userId)
  const { data: activity } = useMemberActivity(userId)

  return (
    <>
      <div>
        <h2 className="text-sm font-semibold text-muted">Shelf</h2>
        {shelf?.length === 0 ? (
          <p className="mt-2 text-xs text-muted">No books on the shelf yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {shelf?.map((entry) => <ShelfRow key={entry.book_id} entry={entry} />)}
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
