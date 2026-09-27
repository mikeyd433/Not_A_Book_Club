import type { CSSProperties } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import { useBook } from '@/lib/books/queries'
import { contrastForHex } from '@/lib/image'

// Wraps every /book/:bookId/* route so its accent color (pulled from the
// displayed cover) themes the whole book, not just one screen.
export default function BookLayout() {
  const { bookId } = useParams<{ bookId: string }>()
  const { data: book } = useBook(bookId!)

  const style: CSSProperties | undefined = book?.accent_color
    ? ({
        '--color-accent': book.accent_color,
        '--color-accent-contrast': contrastForHex(book.accent_color),
      } as CSSProperties)
    : undefined

  return (
    <div style={style}>
      <Outlet />
    </div>
  )
}
