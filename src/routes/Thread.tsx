import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useAddChapterAndAdvance,
  useBook,
  useChapters,
  useFullAccess,
  useMyShelfEntry,
  useTaggableChapters,
  useUpsertShelfEntry,
} from '@/lib/books/queries'
import { celebrate } from '@/lib/celebrate'
import { confirmAdvance } from '@/lib/books/confirmAdvance'
import { useComments, useLockedCommentCount, usePostComment } from '@/lib/comments/queries'
import { buildForest, type Comment, type TreeNode } from '@/lib/discussion/forest'
import ChapterSection, { LockedChapterBar } from '@/components/discussion/ChapterSection'
import ChapterWheelPicker from '@/components/ChapterWheelPicker'
import CoverThumb from '@/components/CoverThumb'
import QueryError from '@/components/QueryError'
import type { MyGroup } from '@/lib/group/useMyGroup'
import { CONDENSED_BAR_SHOW_AFTER, useScrolledPast } from '@/lib/useScrolledPast'

// Flush with the very top of the viewport (just clearing the
// notch/status-bar inset) rather than leaving room for Layout's global
// header above it -- that header is itself position: sticky, which isn't
// actually staying put in the WebView this installed PWA runs in (same
// reason this bar switched away from sticky), so reserving space for it
// here just left a gap with scrolled-past content showing through.
const CONDENSED_BAR_TOP = 'env(safe-area-inset-top)'

type ChapterOrder = 'asc' | 'desc'
const CHAPTER_ORDER_KEY = 'nabc-chapter-order'

export default function Thread({ group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
  const { data: book } = useBook(bookId!)
  const { data: chapters } = useChapters(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const {
    data: comments,
    isError: commentsError,
    error: commentsErrorDetail,
    refetch: refetchComments,
  } = useComments(bookId!)
  const { data: lockedCount } = useLockedCommentCount(bookId!)
  const upsertShelf = useUpsertShelfEntry(bookId!)
  const postComment = usePostComment(bookId!)
  const taggableChapters = useTaggableChapters(bookId!)
  const addNextChapter = useAddChapterAndAdvance(bookId!)
  const fullAccess = useFullAccess(bookId!)

  const isAdmin = group.role === 'admin'
  const [addChapterError, setAddChapterError] = useState('')
  const [showChapterPicker, setShowChapterPicker] = useState(false)
  // Bumped on a cancelled advance to force the wheel picker to remount and
  // re-settle on the still-current chapter -- see BookDetail's picker for
  // why this is needed.
  const [pickerResetKey, setPickerResetKey] = useState(0)
  const showCondensedBar = useScrolledPast(CONDENSED_BAR_SHOW_AFTER)
  // Per-device, not synced to the account -- this is just "which end do I
  // want to scroll from today," not a collaborative setting like the
  // per-chapter reveal state, so it doesn't need a shelf_entries round trip.
  const [chapterOrder, setChapterOrder] = useState<ChapterOrder>(() => {
    if (typeof window === 'undefined') return 'asc'
    return window.localStorage.getItem(CHAPTER_ORDER_KEY) === 'desc' ? 'desc' : 'asc'
  })

  // Marks this book's comment activity as seen once the reader actually
  // reaches the discussion (not the "read chapter 1 to start" gate above
  // it) -- Home's unlocked-comment badge reads this back to only count
  // what's happened since. The ref guards against re-firing on every
  // render once myEntry settles; it's reset per book so switching between
  // books in the same session still marks each one independently.
  const markedSeenForBookRef = useRef<string | null>(null)
  useEffect(() => {
    if (!myEntry?.id || (!myEntry.current_chapter_id && !fullAccess)) return
    if (markedSeenForBookRef.current === bookId) return
    markedSeenForBookRef.current = bookId ?? null
    upsertShelf.mutate({ comments_seen_at: new Date().toISOString() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, myEntry?.id, myEntry?.current_chapter_id, fullAccess])

  function toggleChapterOrder() {
    setChapterOrder((prev) => {
      const next: ChapterOrder = prev === 'asc' ? 'desc' : 'asc'
      window.localStorage.setItem(CHAPTER_ORDER_KEY, next)
      return next
    })
  }

  async function handleAddFirstChapter() {
    const defaultLabel = `Chapter ${addNextChapter.nextChapterNumber}`
    const input = window.prompt(
      'Name this chapter (leave blank to just number it):',
      defaultLabel,
    )
    if (input === null) return
    setAddChapterError('')
    try {
      await addNextChapter.addAndAdvance(input.trim() || defaultLabel)
      celebrate()
    } catch (err) {
      setAddChapterError(
        err instanceof Error ? err.message : 'Failed to add the chapter.',
      )
    }
  }

  // Replies can be tagged to a later chapter than the comment they're
  // replying to (see CommentNode's replyChapters), so the tree is built
  // once across every comment regardless of chapter -- parent/child links
  // stay correct -- and only root comments get partitioned by chapter
  // afterward, for display as separate sections.
  const allRoots = useMemo(
    () => buildForest((comments ?? []) as Comment[]),
    [comments],
  )
  const rootsByChapter = useMemo(() => {
    const map = new Map<string, TreeNode[]>()
    for (const node of allRoots) {
      const list = map.get(node.comment.chapter_id)
      if (list) {
        list.push(node)
      } else {
        map.set(node.comment.chapter_id, [node])
      }
    }
    return map
  }, [allRoots])

  // Every chapter gets stacked here, not just taggable ones -- chapters
  // past the reader's current position render as a locked bar (below)
  // instead of being silently omitted, so Discussion still shows the whole
  // book's shape. The reply/retag chapter dropdowns (passed to
  // ChapterSection as taggableChapters) always stay in natural reading
  // order regardless of this -- only the order sections are stacked in
  // changes.
  const orderedChapters = useMemo(() => {
    const list = chapters ?? []
    return chapterOrder === 'asc' ? list : [...list].reverse()
  }, [chapters, chapterOrder])
  const taggableIds = useMemo(
    () => new Set(taggableChapters.map((c) => c.id)),
    [taggableChapters],
  )

  const revealedChapterIds = myEntry?.revealed_chapter_ids ?? []

  function revealChapter(chapterId: string) {
    if (revealedChapterIds.includes(chapterId)) return
    upsertShelf.mutate({
      revealed_chapter_ids: [...revealedChapterIds, chapterId],
    })
  }

  if (myEntry === undefined || chapters === undefined) {
    return <p className="text-sm text-muted">Loading…</p>
  }

  if (chapters.length === 0) {
    const canAddChapters =
      myEntry?.status === 'reading' ||
      myEntry?.status === 'paused' ||
      myEntry?.status === 'read_before_joining'
    return (
      <div className="rounded-card bg-surface p-4 text-center">
        <p className="text-sm text-muted">
          This book doesn't have any chapters yet.
        </p>
        {canAddChapters ? (
          <button
            onClick={handleAddFirstChapter}
            disabled={addNextChapter.isPending}
            className="mt-3 min-h-11 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-contrast disabled:opacity-60"
          >
            {addNextChapter.isPending ? 'Adding…' : '+ Add chapter 1'}
          </button>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Set your shelf status to "Reading now" from Overview to add the
            first one.
          </p>
        )}
        {addChapterError && (
          <p className="mt-2 text-xs text-red-600">{addChapterError}</p>
        )}
      </div>
    )
  }

  // Landing on Discussion is now the default entry point from Home, before
  // anyone has necessarily visited Overview to set a reading position --
  // but is_chapter_unlocked has nothing to compare against without one, so
  // with no position set literally nothing unlocks, not even chapter 1.
  // Gate behind one explicit tap instead of silently marking the first
  // chapter read on their behalf -- only shown this once, since it
  // disappears for good the moment a real position is set (here or via
  // Overview's chapter picker).
  // Full access (finished, or read before joining) has nothing to "catch
  // up" on -- useTaggableChapters already unlocks every chapter for them
  // regardless of current_chapter_id, so this gate must skip for them too,
  // or they'd be stuck being told to "read Chapter 1" on a book they've
  // already finished.
  if (!myEntry || (!myEntry.current_chapter_id && !fullAccess)) {
    return (
      <div className="rounded-card bg-surface p-4 text-center">
        <p className="text-sm text-muted">
          Read {chapters[0].label} to start the discussion.
        </p>
        <button
          onClick={() => upsertShelf.mutate({ current_chapter_id: chapters[0].id })}
          disabled={upsertShelf.isPending}
          className="mt-3 min-h-11 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-contrast disabled:opacity-60"
        >
          ✅ I finished {chapters[0].label}
        </button>
      </div>
    )
  }

  if (commentsError) {
    return <QueryError error={commentsErrorDetail} onRetry={() => refetchComments()} />
  }

  const currentChapter = chapters.find((c) => c.id === myEntry.current_chapter_id)

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
    upsertShelf.mutate({ current_chapter_id: chapterId })
  }

  return (
    <div className="space-y-4">
      {/* Only exists in the DOM once scrolled past BookLayout's own
          cover/title/tabs header -- not shown at the very top, where that
          header is already doing the same job. position: fixed rather than
          sticky: sticky turned out not to reliably stay put in the WebView
          this installed PWA actually runs in. */}
      {showCondensedBar && (
        <div
          className="fixed inset-x-0 z-20 bg-surface"
          style={{ top: CONDENSED_BAR_TOP }}
        >
          <div className="border-b border-border px-4 py-2">
            <div className="flex items-center gap-3">
              <CoverThumb
                book={book ?? { title: '', open_library_cover_url: null, default_cover: null }}
                personalCoverPath={myEntry.personal_cover?.storage_path}
                className="w-14 flex-shrink-0 rounded"
              />
              <p className="min-w-0 flex-1 break-words text-base font-bold">{book?.title}</p>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => setShowChapterPicker((s) => !s)}
                className="flex max-w-[12rem] items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-accent"
              >
                <span className="min-w-0 truncate">{currentChapter?.label ?? 'Set chapter'}</span>
                <span className="flex-shrink-0">▾</span>
              </button>
            </div>
          </div>

          {showChapterPicker && (
            <div className="border-b border-border bg-surface p-2">
              <ChapterWheelPicker
                key={pickerResetKey}
                items={chapters.map((c) => ({ id: c.id, label: c.label }))}
                value={myEntry.current_chapter_id}
                onChange={handleChapterPicked}
              />
            </div>
          )}
        </div>
      )}

      <div className="space-y-5">
        {(!showCondensedBar || chapters.length > 1) && (
          <div className="flex items-center justify-between gap-2">
            {/* At the top of the page, this is the chapter picker -- a
                bigger, easier target than the condensed bar's small pill
                version below, which takes over once scrolled past the
                header (same showChapterPicker state, so a picker left open
                while scrolling just relocates rather than closing). */}
            {!showCondensedBar && (
              <button
                onClick={() => setShowChapterPicker((s) => !s)}
                className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-card bg-surface px-3 py-2 text-left"
              >
                <span className="flex-shrink-0 text-sm font-semibold">Current chapter</span>
                <span className="min-w-0 truncate text-sm text-accent">
                  {currentChapter?.label ?? 'Set chapter'} ▾
                </span>
              </button>
            )}
            {chapters.length > 1 && (
              <button
                onClick={toggleChapterOrder}
                className="min-h-9 flex-shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted active:bg-surface-alt"
              >
                {chapterOrder === 'asc' ? '↓ Oldest first' : '↑ Newest first'}
              </button>
            )}
          </div>
        )}
        {!showCondensedBar && showChapterPicker && (
          <div className="rounded-card bg-surface p-2">
            <ChapterWheelPicker
              key={pickerResetKey}
              items={chapters.map((c) => ({ id: c.id, label: c.label }))}
              value={myEntry.current_chapter_id}
              onChange={handleChapterPicked}
            />
          </div>
        )}
        {orderedChapters.map((chapter) =>
          taggableIds.has(chapter.id) ? (
            <ChapterSection
              key={chapter.id}
              chapter={chapter}
              roots={rootsByChapter.get(chapter.id) ?? []}
              isRevealed={revealedChapterIds.includes(chapter.id)}
              onReveal={() => revealChapter(chapter.id)}
              taggableChapters={taggableChapters}
              isAdmin={isAdmin}
              bookId={bookId!}
              onPost={async (input) => {
                await postComment.mutateAsync({
                  ...input,
                  madeDuringReread: myEntry!.is_rereading,
                })
              }}
              onReply={async (input, parentId) => {
                await postComment.mutateAsync({
                  ...input,
                  parentId,
                  madeDuringReread: myEntry!.is_rereading,
                })
              }}
            />
          ) : (
            <LockedChapterBar key={chapter.id} label={chapter.label} />
          ),
        )}

        {Boolean(lockedCount) && (
          <p className="rounded-lg bg-surface-alt p-3 text-center text-xs text-muted">
            🔒 {lockedCount} comment{lockedCount === 1 ? '' : 's'} ahead — keep
            reading to unlock
          </p>
        )}
      </div>
    </div>
  )
}
