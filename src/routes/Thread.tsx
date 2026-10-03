import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useAddChapterAndAdvance,
  useChapters,
  useMyShelfEntry,
  useTaggableChapters,
  useUpsertShelfEntry,
} from '@/lib/books/queries'
import { celebrate } from '@/lib/celebrate'
import { useComments, useLockedCommentCount, usePostComment } from '@/lib/comments/queries'
import { buildForest, type Comment, type TreeNode } from '@/lib/discussion/forest'
import ChapterSection from '@/components/discussion/ChapterSection'
import QueryError from '@/components/QueryError'
import type { MyGroup } from '@/lib/group/useMyGroup'

export default function Thread({ group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
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

  return (
    <div className="space-y-4">
      {taggableChapters.length === 0 ? (
        <p className="rounded-lg bg-surface-alt p-3 text-xs text-muted">
          Set your current chapter to start commenting.
        </p>
      ) : (
        <div className="space-y-5">
          {taggableChapters.map((chapter, i) => (
            <ChapterSection
              key={chapter.id}
              chapter={chapter}
              roots={rootsByChapter.get(chapter.id) ?? []}
              isRevealed={revealedChapterIds.includes(chapter.id)}
              onReveal={() => revealChapter(chapter.id)}
              taggableChapters={taggableChapters}
              isAdmin={isAdmin}
              bookId={bookId!}
              divider={i > 0}
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
          ))}

          {Boolean(lockedCount) && (
            <p className="rounded-lg bg-surface-alt p-3 text-center text-xs text-muted">
              🔒 {lockedCount} comment{lockedCount === 1 ? '' : 's'} ahead — keep
              reading to unlock
            </p>
          )}
        </div>
      )}
    </div>
  )
}
