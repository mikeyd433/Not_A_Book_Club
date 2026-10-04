import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useDeletePost,
  useFlagPost,
  useResolvePostFlag,
  useTogglePostReaction,
} from '@/lib/bulletin/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import { formatRelativeTime } from '@/lib/time'
import AttachmentImage from '@/components/AttachmentImage'
import Avatar from '@/components/Avatar'
import type { TreeNode } from '@/lib/bulletin/forest'
import Composer, { type ComposerSubmit } from './Composer'

const REACTION_PALETTE = ['👍', '❤️', '😂', '😮', '😢']

export default function PostNode({
  node,
  isAdmin,
  groupId,
  onReply,
  depth = 0,
}: {
  node: TreeNode
  isAdmin: boolean
  groupId: string
  onReply: (input: ComposerSubmit, parentId: string) => Promise<void>
  depth?: number
}) {
  const { user } = useAuth()
  const [replying, setReplying] = useState(false)
  const { post, children } = node
  const flagPost = useFlagPost(groupId)
  const resolveFlag = useResolvePostFlag(groupId)
  const deletePost = useDeletePost(groupId)
  const toggleReaction = useTogglePostReaction(groupId)

  const isAuthor = post.user_id === user?.id
  const canModerate = post.flagged && (isAuthor || isAdmin)

  const reactionCounts = REACTION_PALETTE.map((emoji) => ({
    emoji,
    count: post.group_post_reactions.filter((r) => r.emoji === emoji).length,
    mine: post.group_post_reactions.some(
      (r) => r.emoji === emoji && r.user_id === user?.id,
    ),
  }))

  return (
    <li className={depth > 0 ? 'ml-3 border-l border-border pl-2' : ''}>
      <div className="flex gap-2 border-b border-border py-2">
        <Link to={`/member/${post.user_id}`} className="flex-shrink-0">
          <Avatar
            path={post.profiles?.avatar_url}
            name={post.profiles?.display_name ?? 'Someone'}
            size={28}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
            <Link to={`/member/${post.user_id}`} className="font-semibold text-text">
              {post.profiles?.display_name ?? 'Someone'}
            </Link>
            <span className="text-xs text-muted">{formatRelativeTime(post.created_at)}</span>
          </div>

          {canModerate && (
            <div className="mt-1 rounded-lg bg-surface-alt p-2 text-xs">
              <p className="font-semibold">🚩 Flagged</p>
              <p className="mt-0.5 text-muted">
                Only you and admins can see this until it's dismissed or removed.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => resolveFlag.mutate(post.id)}
                  className="min-h-9 rounded-md border border-accent px-2 py-1.5 font-medium text-accent"
                >
                  Dismiss flag
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Remove this post?')) {
                      deletePost.mutate(post.id)
                    }
                  }}
                  className="min-h-9 rounded-md border border-border px-2 py-1.5 font-medium text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{post.body}</p>

          {post.group_post_attachments.map((a) => (
            <AttachmentImage
              key={a.id}
              path={a.storage_path}
              gifUrl={a.gif_url}
              bucket="bulletin-attachments"
            />
          ))}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <button onClick={() => setReplying((r) => !r)} className="font-semibold text-accent">
              Reply
            </button>
            {reactionCounts.map(({ emoji, count, mine }) => (
              <button
                key={emoji}
                onClick={() =>
                  toggleReaction.mutate({ postId: post.id, emoji, reacted: mine })
                }
                className={mine ? 'font-semibold text-accent' : 'text-muted'}
              >
                {emoji}
                {count > 0 && ` ${count}`}
              </button>
            ))}
            {!post.flagged && (
              <button onClick={() => flagPost.mutate(post.id)} className="text-muted">
                🚩 Flag
              </button>
            )}
            {isAuthor && !post.flagged && (
              <button
                onClick={() => {
                  if (window.confirm('Delete this post?')) {
                    deletePost.mutate(post.id)
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
                onSubmit={async (input) => {
                  await onReply(input, post.id)
                  setReplying(false)
                }}
                compact
              />
            </div>
          )}
        </div>
      </div>
      {children.length > 0 && (
        <ul>
          {children.map((child) => (
            <PostNode
              key={child.post.id}
              node={child}
              isAdmin={isAdmin}
              groupId={groupId}
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
