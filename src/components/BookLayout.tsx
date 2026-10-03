import type { CSSProperties, ReactNode } from 'react'
import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useBook, useChapters, useMyShelfEntry } from '@/lib/books/queries'
import { contrastForHex } from '@/lib/image'
import CoverThumb from '@/components/CoverThumb'
import QueryError from '@/components/QueryError'

// Wraps every /book/:bookId/* route: themes it with the accent color
// pulled from the displayed cover, and gives every sub-page (Overview,
// Discussion, Chapters, Reviews, Covers) the same tab nav to jump between
// them. Previously only BookDetail (Overview) had this nav, which meant
// landing directly on any other sub-page -- as Home's book links now do,
// straight into Discussion -- left no way to reach the others.
export default function BookLayout() {
  const { bookId } = useParams<{ bookId: string }>()
  const { data: book, isError, error, refetch } = useBook(bookId!)
  const { data: chapters } = useChapters(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)

  const style: CSSProperties | undefined = book?.accent_color
    ? ({
        '--color-accent': book.accent_color,
        '--color-accent-contrast': contrastForHex(book.accent_color),
      } as CSSProperties)
    : undefined

  if (isError) return <QueryError error={error} onRetry={() => refetch()} />

  if (!book) return <div style={style} />

  return (
    <div style={style} className="space-y-4">
      <div className="flex gap-3">
        <NavLink to={`/book/${book.id}`} end className="w-16 flex-shrink-0">
          <CoverThumb
            book={book}
            personalCoverPath={myEntry?.personal_cover?.storage_path}
          />
        </NavLink>
        <div className="min-w-0">
          <h1 className="break-words text-lg font-bold">{book.title}</h1>
          <p className="break-words text-sm text-muted">{book.author}</p>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <BookTab to={`/book/${book.id}`} end>
          Overview
        </BookTab>
        <BookTab to={`/book/${book.id}/thread`}>Discussion</BookTab>
        <BookTab to={`/book/${book.id}/chapters`}>
          Chapters ({chapters?.length ?? 0}){book.is_complete ? ' ✓' : ''}
        </BookTab>
        <BookTab to={`/book/${book.id}/reviews`}>⭐ Reviews</BookTab>
        <BookTab to={`/book/${book.id}/covers`}>Covers</BookTab>
      </div>

      <Outlet />
    </div>
  )
}

function BookTab({
  to,
  end,
  children,
}: {
  to: string
  end?: boolean
  children: ReactNode
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `min-h-9 flex-shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium leading-tight ${
          isActive
            ? 'bg-accent text-accent-contrast'
            : 'border border-border text-muted'
        }`
      }
    >
      {children}
    </NavLink>
  )
}
