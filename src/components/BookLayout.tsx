import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  coverPublicUrl,
  useBook,
  useChapters,
  useMyShelfEntry,
  useUpsertShelfEntry,
} from '@/lib/books/queries'
import { computeAccentColorFromUrl, contrastForHex } from '@/lib/image'
import { supabase } from '@/lib/supabase'
import CoverThumb, { resolveCoverSrc } from '@/components/CoverThumb'
import ProgressBar from '@/components/ProgressBar'
import QueryError from '@/components/QueryError'

// Wraps every /book/:bookId/* route: themes it with the accent color
// pulled from the displayed cover, and gives every sub-page (Overview,
// Discussion, Chapters, Reviews, Covers) the same tab nav to jump between
// them. Previously only BookDetail (Overview) had this nav, which meant
// landing directly on any other sub-page -- as Home's book links now do,
// straight into Discussion -- left no way to reach the others.
export default function BookLayout() {
  const { bookId } = useParams<{ bookId: string }>()
  const queryClient = useQueryClient()
  const { data: book, isError, error, refetch } = useBook(bookId!)
  const { data: chapters } = useChapters(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const upsert = useUpsertShelfEntry(bookId!)

  // Backfill for books added before accent_color was computed for
  // Open-Library-sourced covers (useAddBook), and the rare case of a
  // default cover set some other way without it. Best-effort and
  // per-mount only (not retried within the same visit) -- a CORS/load
  // failure just leaves it themeless, same as it already was.
  const backfilledForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!book || book.accent_color || backfilledForRef.current === book.id) return
    const sourceUrl = book.default_cover
      ? coverPublicUrl(book.default_cover.storage_path)
      : book.open_library_cover_url
    if (!sourceUrl) return
    backfilledForRef.current = book.id
    computeAccentColorFromUrl(sourceUrl).then((result) => {
      if (!result) return
      supabase
        .from('books')
        .update({ accent_color: result.accent })
        .eq('id', book.id)
        .then(({ error: updateError }) => {
          if (updateError) return
          queryClient.invalidateQueries({ queryKey: ['book', book.id] })
        })
    })
  }, [book, queryClient])

  const [showCoverLightbox, setShowCoverLightbox] = useState(false)

  // Shown under the title/author on every tab, not just Overview -- same
  // "finished/read-before-joining has nothing to show a position for"
  // exclusion as Home's and MemberProfile's book rows.
  const currentChapterForProgress = chapters?.find((c) => c.id === myEntry?.current_chapter_id)
  const currentRank = chapters
    ? chapters.findIndex((c) => c.id === myEntry?.current_chapter_id) + 1
    : 0
  const hasMeaningfulChapter =
    myEntry?.status !== 'finished' && myEntry?.status !== 'read_before_joining'
  const showProgress = Boolean(myEntry) && hasMeaningfulChapter && (chapters?.length ?? 0) > 0

  const style: CSSProperties | undefined = book?.accent_color
    ? ({
        '--color-accent': book.accent_color,
        '--color-accent-contrast': contrastForHex(book.accent_color),
      } as CSSProperties)
    : undefined

  if (isError) return <QueryError error={error} onRetry={() => refetch()} />

  if (!book) return <div style={style} />

  const coverSrc = resolveCoverSrc(book, myEntry?.personal_cover?.storage_path)

  return (
    <div style={style} className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <button
            onClick={() => coverSrc && setShowCoverLightbox(true)}
            className="w-16 flex-shrink-0"
            aria-label="View cover larger"
          >
            <CoverThumb
              book={book}
              personalCoverPath={myEntry?.personal_cover?.storage_path}
            />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-lg font-bold">{book.title}</h1>
            <p className="break-words text-sm text-muted">{book.author}</p>
            {showProgress && (
              <div className="mt-2">
                <ProgressBar
                  current={currentRank}
                  total={chapters?.length ?? 0}
                  currentLabel={currentChapterForProgress?.label}
                />
              </div>
            )}
          </div>
        </div>
        {myEntry && (
          <button
            onClick={() => upsert.mutate({ muted: !myEntry.muted })}
            disabled={upsert.isPending}
            aria-label={
              myEntry.muted
                ? 'Unmute notifications for this book'
                : 'Mute notifications for this book'
            }
            title={
              myEntry.muted
                ? 'Notifications muted for this book'
                : 'Notifications on for this book'
            }
            className="flex size-10 flex-shrink-0 items-center justify-center rounded-full border border-border text-lg disabled:opacity-60"
          >
            {myEntry.muted ? '🔕' : '🔔'}
          </button>
        )}
      </div>

      <div
        data-tour="book-tabs"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]"
      >
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

      {showCoverLightbox && coverSrc && (
        <button
          onClick={() => setShowCoverLightbox(false)}
          aria-label="Close"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
          <img
            src={coverSrc}
            alt={book.title}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </button>
      )}
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
