import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  coverPublicUrl,
  useBook,
  useChapters,
  useMyShelfEntry,
  useUpsertShelfEntry,
} from '@/lib/books/queries'
import { celebrate } from '@/lib/celebrate'
import { confirmAdvance } from '@/lib/books/confirmAdvance'
import { computeAccentColorFromUrl, contrastForHex } from '@/lib/image'
import { supabase } from '@/lib/supabase'
import { CONDENSED_BAR_SHOW_AFTER, useScrolledPast } from '@/lib/useScrolledPast'
import ChapterWheelPicker from '@/components/ChapterWheelPicker'
import CoverThumb, { resolveCoverSrc } from '@/components/CoverThumb'
import QueryError from '@/components/QueryError'

// Wraps every /book/:bookId/* route: themes it with the accent color
// pulled from the displayed cover, and gives every sub-page (Overview,
// Discussion, Chapters, Reviews, Covers) the same tab nav to jump between
// them. Previously only BookDetail (Overview) had this nav, which meant
// landing directly on any other sub-page -- as Home's book links now do,
// straight into Discussion -- left no way to reach the others.
export default function BookLayout() {
  const { bookId } = useParams<{ bookId: string }>()
  const { pathname } = useLocation()
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
  const [showChapterPicker, setShowChapterPicker] = useState(false)
  // Bumped on a cancelled advance to force the wheel picker to remount and
  // re-settle on the still-current chapter -- see BookDetail's picker for
  // why this is needed.
  const [pickerResetKey, setPickerResetKey] = useState(0)
  // Thread's own condensed bar carries a chapter picker too, once scrolled
  // past this same threshold -- this one is only for the gap before that,
  // while BookLayout's header (with the bell this sits under) is still the
  // thing on screen.
  const scrolledPastHeader = useScrolledPast(CONDENSED_BAR_SHOW_AFTER)
  const isDiscussion = pathname === `/book/${bookId}/thread`

  useEffect(() => {
    if (scrolledPastHeader) setShowChapterPicker(false)
  }, [scrolledPastHeader])

  const currentChapter = chapters?.find((c) => c.id === myEntry?.current_chapter_id)
  const showPickerTrigger =
    isDiscussion && !scrolledPastHeader && Boolean(myEntry) && (chapters?.length ?? 0) > 0

  function handleChapterPicked(chapterId: string) {
    const newChapter = chapters?.find((c) => c.id === chapterId)
    if (!newChapter) return
    const oldPosition = currentChapter?.position
    if (!confirmAdvance(chapters ?? [], oldPosition, newChapter)) {
      setPickerResetKey((k) => k + 1)
      return
    }
    if (oldPosition === undefined || newChapter.position > oldPosition) {
      celebrate()
    }
    upsert.mutate({ current_chapter_id: chapterId })
  }

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
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
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
          {/* Stacked under the bell rather than its own row below this one,
              so the tab row (right under this) sits at the same height on
              Discussion as it does on every other tab. */}
          {showPickerTrigger && (
            <button
              onClick={() => setShowChapterPicker((s) => !s)}
              className="flex max-w-[12rem] items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-accent"
            >
              <span className="min-w-0 truncate">{currentChapter?.label ?? 'Set chapter'}</span>
              <span className="flex-shrink-0">▾</span>
            </button>
          )}
        </div>
      </div>

      {showPickerTrigger && showChapterPicker && (
        <div className="rounded-card bg-surface p-2">
          <ChapterWheelPicker
            key={pickerResetKey}
            items={(chapters ?? []).map((c) => ({ id: c.id, label: c.label }))}
            value={myEntry?.current_chapter_id ?? null}
            onChange={handleChapterPicked}
          />
        </div>
      )}

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
