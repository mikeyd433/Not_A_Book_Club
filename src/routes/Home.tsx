import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  useChapters,
  useGroupBooks,
  useMyShelfEntry,
} from '@/lib/books/queries'
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
        <Link to="/add-book" className="mt-2 inline-block text-sm text-accent">
          Add your first book
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Your shelf</h1>
      {books.map((book) => (
        <BookRow key={book.id} book={book} />
      ))}
    </div>
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
  const { data: unlockedCount } = useUnlockedCommentCount(book.id)

  const currentPosition = chapters?.find(
    (c) => c.id === entry?.current_chapter_id,
  )?.position

  return (
    <Link
      to={`/book/${book.id}`}
      className="flex gap-3 rounded-card bg-surface p-3"
    >
      <CoverThumb book={book} className="w-14 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold">{book.title}</p>
        <p className="text-xs text-muted">{book.author}</p>
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
        {typeof unlockedCount === 'number' && unlockedCount > 0 && (
          <p className="mt-1 text-xs text-muted">
            💬 {unlockedCount} unlocked comment{unlockedCount === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </Link>
  )
}

function useUnlockedCommentCount(bookId: string) {
  return useQuery({
    queryKey: ['unlocked-comment-count', bookId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('book_id', bookId)

      if (error) throw error
      return count ?? 0
    },
  })
}
