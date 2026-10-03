import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useAddChapterAndAdvance,
  useBook,
  useChapters,
  useMyShelfEntry,
  useTaggableChapters,
  useUpsertShelfEntry,
} from '@/lib/books/queries'
import { celebrate } from '@/lib/celebrate'
import { useComments, useLockedCommentCount, usePostComment } from '@/lib/comments/queries'
import { buildForest, type Comment, type TreeNode } from '@/lib/discussion/forest'
import ChapterSection, { LockedChapterBar } from '@/components/discussion/ChapterSection'
import ChapterWheelPicker from '@/components/ChapterWheelPicker'
import CoverThumb from '@/components/CoverThumb'
import QueryError from '@/components/QueryError'
import type { MyGroup } from '@/lib/group/useMyGroup'

// Matches the global header's own rendered height (see Layout.tsx: a
// max(0.75rem, safe-area-inset) top pad + 0.75rem bottom pad around ~44px
// of content) so this bar sticks directly beneath it instead of
// overlapping -- there's no DOM measurement, just mirroring that formula.
const STICKY_TOP = 'calc(3.5rem + max(0.75rem, env(safe-area-inset-top)))'

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

  const isAdmin = group.role === 'admin'
  const [addChapterError, setAddChapterError] = useState('')
  const [showChapterPicker, setShowChapterPicker] = useState(false)
  // Per-device, not synced to the account -- this is just "which end do I
  // want to scroll from today," not a collaborative setting like the
  // per-chapter reveal state, so it doesn't need a shelf_entries round trip.
  const [chapterOrder, setChapterOrder] = useState<ChapterOrder>(() => {
    if (typeof window === 'undefined') return 'asc'
    return window.localStorage.getItem(CHAPTER_ORDER_KEY) === 'desc' ? 'desc' : 'asc'
  })

  function toggleChapterOrder() {
    setChapterOrder((prev) => {
      const next: ChapterOrder = prev === 'asc' ? 'desc' : 'asc'
      window.localStorage.setItem(CHAPTER_ORDER_KEY, next)
      return next
    })
  }

  async function handleAddFirstChapter() {
    const defaultLabel = `Chapter ${addNextChapter.nextPosition}`
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
    const canAddChapters = myEntry?.status === 'reading' || myEntry?.status === 'paused'
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
  if (!myEntry?.current_chapter_id) {
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
    const newPosition = chapters?.find((c) => c.id === chapterId)?.position
    const oldPosition = currentChapter?.position
    if (
      newPosition !== undefined &&
      (oldPosition === undefined || newPosition > oldPosition)
    ) {
      celebrate()
    }
    upsertShelf.mutate({ current_chapter_id: chapterId })
  }

  return (
    <div className="space-y-4">
      {/* Sticks directly beneath the global header once BookLayout's own
          cover/title/tabs scroll past -- same book, same current-chapter
          control as Overview, just reachable without leaving Discussion. */}
      <div
        className="sticky z-[5] -mx-4 flex items-center gap-2 border-b border-border bg-surface px-4 py-2"
        style={{ top: STICKY_TOP }}
      >
        <CoverThumb
          book={book ?? { title: '', open_library_cover_url: null, default_cover: null }}
          personalCoverPath={myEntry.personal_cover?.storage_path}
          className="w-8 flex-shrink-0"
        />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{book?.title}</p>
        <button
          onClick={() => setShowChapterPicker((s) => !s)}
          className="flex-shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-accent"
        >
          {currentChapter?.label ?? 'Set chapter'} ▾
        </button>
      </div>

      {showChapterPicker && (
        <div className="rounded-card bg-surface p-2">
          <ChapterWheelPicker
            items={chapters.map((c) => ({ id: c.id, label: c.label }))}
            value={myEntry.current_chapter_id}
            onChange={handleChapterPicked}
          />
        </div>
      )}

      <div className="space-y-5">
        {chapters.length > 1 && (
          <div className="flex justify-end">
            <button
              onClick={toggleChapterOrder}
              className="min-h-9 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted active:bg-surface-alt"
            >
              {chapterOrder === 'asc' ? '↓ Oldest first' : '↑ Newest first'}
            </button>
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
