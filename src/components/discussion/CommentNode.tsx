import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChapterOption } from '@/lib/books/queries'
import {
  useDeleteComment,
  useFlagComment,
  useResolveFlag,
  useToggleReaction,
} from '@/lib/comments/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatRelativeTime } from '@/lib/time'
import AttachmentImage from '@/components/AttachmentImage'
import Avatar from '@/components/Avatar'
import { countNodes, type TreeNode } from '@/lib/discussion/forest'
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
  showAllDescendants = false,
}: {
  node: TreeNode
  sectionChapterId: string
  taggableChapters: ChapterOption[]
  isAdmin: boolean
  bookId: string
  onReply: (input: ComposerSubmit, parentId: string) => Promise<void>
  depth?: number
  // Once a "replies from another group" indicator has been tapped open,
  // every descendant under it was part of the same transfer -- cascade
  // straight through without making the viewer tap again at each level.
  showAllDescendants?: boolean
}) {
  const { user } = useAuth()
  const [replying, setReplying] = useState(false)
  const [retagging, setRetagging] = useState(false)
  // Predictions start collapsed -- a lightweight, client-side-only tuck-away
  // (not a server-tracked resolved/verdict state like the old standalone
  // predictions feature), so replies stay hidden along with it too, to
  // avoid a reply giving away the gist before it's revealed.
  const [revealed, setRevealed] = useState(!node.comment.is_prediction)
  const [foreignRevealed, setForeignRevealed] = useState(showAllDescendants)
  const { comment, children } = node

  // A reply carried over by shelf transfer -- defaults to collapsed behind
  // a tap, same reasoning as predictions above, so the thread isn't
  // suddenly full of replies from people the viewer's never heard of with
  // no warning. A transferred *root* comment (rendered by ChapterSection,
  // never reaches here as a "child") is never hidden this way -- only
  // replies brought along with it are.
  const nativeChildren = children.filter((c) => !c.comment.transferred_from_group)
  const foreignChildren = children.filter((c) => c.comment.transferred_from_group)
  const foreignSourceName = foreignChildren[0]?.comment.transferred_from_group?.name
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
    <li className={depth > 0 ? 'ml-3 border-l border-border pl-2' : ''}>
      <div className="flex gap-2 border-b border-border py-2">
        <Link to={`/member/${comment.user_id}`} className="flex-shrink-0">
          <Avatar
            path={comment.profiles?.avatar_url}
            name={comment.profiles?.display_name ?? 'Someone'}
            size={28}
            cacheBust={comment.profiles?.avatar_updated_at}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
            <Link to={`/member/${comment.user_id}`} className="font-semibold text-text">
              {comment.profiles?.display_name ?? 'Someone'}
            </Link>
            <span className="text-xs text-muted">{formatRelativeTime(comment.created_at)}</span>
            {comment.is_prediction && <span title="Prediction">🔮</span>}
            {comment.no_spoilers && <span title="No spoilers please">❓</span>}
            {comment.made_during_reread && (
              <span title="Posted during a reread">🔁</span>
            )}
            {showChapterTag && comment.chapters && (
              <span className="rounded-full bg-surface-alt px-1.5 py-0.5 text-xs text-muted">
                {comment.chapters.label}
              </span>
            )}
          </div>

          {comment.is_prediction && !revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="mt-1 text-left text-xs text-muted underline decoration-dotted"
            >
              🔮 made a prediction — tap to reveal
            </button>
          ) : (
            <>
              {canModerate && (
                <div className="mt-1 rounded-lg bg-surface-alt p-2 text-xs">
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

              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
                {renderBody(comment.body, comment.spoiler_blocks)}
              </p>

              {comment.comment_attachments.map((a) => (
                <AttachmentImage key={a.id} path={a.storage_path} gifUrl={a.gif_url} />
              ))}

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <button
                  onClick={() => setReplying((r) => !r)}
                  className="font-semibold text-accent"
                >
                  Reply
                </button>
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
                    className={mine ? 'font-semibold text-accent' : 'text-muted'}
                  >
                    {emoji}
                    {count > 0 && ` ${count}`}
                  </button>
                ))}
                {!comment.flagged && (
                  <button onClick={() => flagComment.mutate(comment.id)} className="text-muted">
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
                    className="text-red-600"
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
      </div>
      {revealed && nativeChildren.length > 0 && (
        <ul>
          {nativeChildren.map((child) => (
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
      {revealed && foreignChildren.length > 0 && (
        <ul>
          {!foreignRevealed ? (
            <li className="ml-3 border-l border-border pl-2">
              <button
                onClick={() => setForeignRevealed(true)}
                className="w-full border-b border-border py-2 text-left text-xs text-muted underline decoration-dotted"
              >
                🔁 {countNodes(foreignChildren)}{' '}
                {countNodes(foreignChildren) === 1 ? 'reply' : 'replies'}
                {foreignSourceName ? ` from ${foreignSourceName}` : ' from another group'} — tap
                to view
              </button>
            </li>
          ) : (
            foreignChildren.map((child) => (
              <CommentNode
                key={child.comment.id}
                node={child}
                sectionChapterId={sectionChapterId}
                taggableChapters={taggableChapters}
                isAdmin={isAdmin}
                bookId={bookId}
                onReply={onReply}
                depth={depth + 1}
                showAllDescendants
              />
            ))
          )}
        </ul>
      )}
    </li>
  )
}
