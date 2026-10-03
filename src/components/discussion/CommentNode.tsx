import { useState } from 'react'
import type { ChapterOption } from '@/lib/books/queries'
import {
  useDeleteComment,
  useFlagComment,
  useResolveFlag,
  useToggleReaction,
} from '@/lib/comments/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import AttachmentImage from '@/components/AttachmentImage'
import Avatar from '@/components/Avatar'
import type { TreeNode } from '@/lib/discussion/forest'
import { renderBody } from './SpoilerChip'
import Composer, { type ComposerSubmit } from './Composer'

const REACTION_PALETTE = ['👍', '❤️', '😂', '😮', '😢']

export default function CommentNode({
  node,
  sectionChapterId,
  taggableChapters,
  isAdmin,
  bookId,
  onReply,
  depth = 0,
}: {
  node: TreeNode
  sectionChapterId: string
  taggableChapters: ChapterOption[]
  isAdmin: boolean
  bookId: string
  onReply: (input: ComposerSubmit, parentId: string) => Promise<void>
  depth?: number
}) {
  const { user } = useAuth()
  const [replying, setReplying] = useState(false)
  const [retagging, setRetagging] = useState(false)
  // Predictions start collapsed -- a lightweight, client-side-only tuck-away
  // (not a server-tracked resolved/verdict state like the old standalone
  // predictions feature), so replies stay hidden along with it too, to
  // avoid a reply giving away the gist before it's revealed.
  const [revealed, setRevealed] = useState(!node.comment.is_prediction)
  const { comment, children } = node
  const flagComment = useFlagComment(bookId)
  const resolveFlag = useResolveFlag(bookId)
  const deleteComment = useDeleteComment(bookId)
  const toggleReaction = useToggleReaction(bookId)

  const isAuthor = comment.user_id === user?.id
  const canModerate = comment.flagged && (isAuthor || isAdmin)
  // A reply nests under its parent (handled by buildForest) even when
  // tagged to a different chapter than the section it's rendered in --
  // show the tag only then, since the section header already establishes
  // it for every comment that matches.
  const showChapterTag = comment.chapter_id !== sectionChapterId

  const parentPosition = comment.chapters?.position
  const replyChapters =
    comment.no_spoilers && parentPosition !== undefined
      ? taggableChapters.filter((c) => c.position <= parentPosition)
      : taggableChapters

  const reactionCounts = REACTION_PALETTE.map((emoji) => ({
    emoji,
    count: comment.reactions.filter((r) => r.emoji === emoji).length,
    mine: comment.reactions.some((r) => r.emoji === emoji && r.user_id === user?.id),
  })).filter((r) => r.count > 0 || true)

  return (
    <li className={depth > 0 ? 'ml-4 border-l border-border pl-3' : ''}>
      <div className="rounded-card bg-surface p-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="flex min-w-0 items-center gap-1.5 font-semibold text-text">
            <Avatar
              path={comment.profiles?.avatar_url}
              name={comment.profiles?.display_name ?? 'Someone'}
              size={20}
            />
            <span className="truncate">{comment.profiles?.display_name ?? 'Someone'}</span>
          </span>
          <span className="flex items-center gap-1">
            {comment.is_prediction && <span title="Prediction">🔮</span>}
            {comment.no_spoilers && (
              <span title="No spoilers please">❓</span>
            )}
            {comment.made_during_reread && (
              <span title="Posted during a reread">🔁</span>
            )}
            {showChapterTag && comment.chapters && (
              <span className="rounded-full bg-surface-alt px-2 py-0.5">
                Ch. {comment.chapters.position}
              </span>
            )}
          </span>
        </div>

        {comment.is_prediction && !revealed ? (
          <button
            onClick={() => setRevealed(true)}
            className="mt-2 w-full rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs text-muted"
          >
            🔮 {comment.profiles?.display_name ?? 'Someone'} made a prediction —
            tap to reveal
          </button>
        ) : (
          <>
            {canModerate && (
              <div className="mt-2 rounded-lg bg-surface-alt p-2 text-xs">
                <p className="font-semibold">🚩 Flagged as a spoiler</p>
                <p className="mt-0.5 text-muted">
                  Only you and admins can see this until it's retagged or removed.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setRetagging((r) => !r)}
                    className="min-h-9 rounded-md border border-border px-2 py-1.5 font-medium"
                  >
                    Retag
                  </button>
                  <button
                    onClick={() => resolveFlag.mutate({ commentId: comment.id })}
                    className="min-h-9 rounded-md border border-accent px-2 py-1.5 font-medium text-accent"
                  >
                    Dismiss flag
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm('Remove this comment?')) {
                        deleteComment.mutate(comment.id)
                      }
                    }}
                    className="min-h-9 rounded-md border border-border px-2 py-1.5 font-medium text-red-600"
                  >
                    Remove
                  </button>
                </div>
                {retagging && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return
                      resolveFlag.mutate({
                        commentId: comment.id,
                        chapterId: e.target.value,
                      })
                      setRetagging(false)
                    }}
                    className="mt-2 min-h-11 w-full rounded-lg border border-border bg-surface px-2 py-2 text-base"
                  >
                    <option value="" disabled>
                      Move to chapter…
                    </option>
                    {taggableChapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {renderBody(comment.body, comment.spoiler_blocks)}
            </p>

            {comment.comment_attachments.map((a) => (
              <AttachmentImage key={a.id} path={a.storage_path} gifUrl={a.gif_url} />
            ))}

            <div className="mt-2 flex flex-wrap items-center gap-1">
              {reactionCounts.map(({ emoji, count, mine }) => (
                <button
                  key={emoji}
                  onClick={() =>
                    toggleReaction.mutate({
                      commentId: comment.id,
                      emoji,
                      reacted: mine,
                    })
                  }
                  className={`min-h-9 rounded-full border px-2 py-1 text-sm ${
                    mine ? 'border-accent bg-accent/10' : 'border-border'
                  }`}
                >
                  {emoji}
                  {count > 0 && <span className="ml-1 text-xs">{count}</span>}
                </button>
              ))}
            </div>

            <div className="mt-1 flex flex-wrap">
              <button
                onClick={() => setReplying((r) => !r)}
                className="-ml-2 min-h-9 rounded-md px-2 py-1.5 text-xs text-accent active:bg-surface-alt"
              >
                Reply
              </button>
              {!comment.flagged && (
                <button
                  onClick={() => flagComment.mutate(comment.id)}
                  className="min-h-9 rounded-md px-2 py-1.5 text-xs text-muted active:bg-surface-alt"
                >
                  🚩 Flag
                </button>
              )}
              {isAuthor && !comment.flagged && (
                <button
                  onClick={() => {
                    if (window.confirm('Delete this comment?')) {
                      deleteComment.mutate(comment.id)
                    }
                  }}
                  className="min-h-9 rounded-md px-2 py-1.5 text-xs text-red-600 active:bg-surface-alt"
                >
                  Delete
                </button>
              )}
            </div>

            {replying && (
              <div className="mt-2">
                <Composer
                  chapters={replyChapters}
                  defaultChapterId={comment.chapter_id}
                  onSubmit={async (input) => {
                    await onReply(input, comment.id)
                    setReplying(false)
                  }}
                  compact
                />
              </div>
            )}
          </>
        )}
      </div>
      {children.length > 0 && revealed && (
        <ul className="mt-2 space-y-2">
          {children.map((child) => (
            <CommentNode
              key={child.comment.id}
              node={child}
              sectionChapterId={sectionChapterId}
              taggableChapters={taggableChapters}
              isAdmin={isAdmin}
              bookId={bookId}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
