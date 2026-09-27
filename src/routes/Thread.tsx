import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useChapters, useMyShelfEntry, useUpsertShelfEntry } from '@/lib/books/queries'
import {
  useComments,
  useDeleteComment,
  useFlagComment,
  useLockedCommentCount,
  usePostComment,
  useResolveFlag,
  useToggleReaction,
  type PendingSpoilerBlock,
} from '@/lib/comments/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { MyGroup } from '@/lib/group/useMyGroup'
import type { SortPref } from '@/types/domain'
import type { Tables } from '@/types/database'

type ChapterOption = { id: string; label: string; position: number }

type Comment = Tables<'comments'> & {
  profiles: { display_name: string } | null
  chapters: { label: string; position: number } | null
  reactions: { user_id: string; emoji: string }[]
  spoiler_blocks: { id: string; ordinal: number; content: string }[]
}

const SORT_LABELS: Record<Exclude<SortPref, 'most_reactions'>, string> = {
  chapter: 'Chapter order',
  newest: 'Newest first',
  recently_unlocked: 'Recently unlocked',
}

const REACTION_PALETTE = ['👍', '❤️', '😂', '😮', '😢']
const SPOILER_MARKER = /\[spoiler #(\d+)\]/g

export default function Thread({ group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
  const { data: chapters } = useChapters(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const { data: comments } = useComments(bookId!)
  const { data: lockedCount } = useLockedCommentCount(bookId!)
  const upsertShelf = useUpsertShelfEntry(bookId!)
  const postComment = usePostComment(bookId!)

  const sortPref = (myEntry?.sort_pref ?? 'chapter') as SortPref
  const isAdmin = group.role === 'admin'

  const taggableChapters = useMemo<ChapterOption[]>(() => {
    if (!chapters || !myEntry) return []
    const fullAccess =
      myEntry.status === 'read_before_joining' ||
      (myEntry.status === 'finished' && (!myEntry.is_rereading || myEntry.spoil_me)) ||
      (myEntry.status === 'dnf' && myEntry.spoil_me)

    if (fullAccess) return chapters

    const currentPosition = chapters.find(
      (c) => c.id === myEntry.current_chapter_id,
    )?.position
    if (currentPosition === undefined) return []
    return chapters.filter((c) => c.position <= currentPosition)
  }, [chapters, myEntry])

  const tree = useMemo(
    () => buildTree((comments ?? []) as Comment[], sortPref),
    [comments, sortPref],
  )

  if (!myEntry) {
    return (
      <p className="rounded-card bg-surface p-4 text-sm text-muted">
        Add this book to your shelf and set a chapter to join the discussion.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Discussion</h1>
        <select
          value={sortPref}
          onChange={(e) =>
            upsertShelf.mutate({ sort_pref: e.target.value as SortPref })
          }
          className="min-h-11 rounded-lg border border-border bg-surface px-2 py-2 text-base"
        >
          {Object.entries(SORT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {taggableChapters.length > 0 ? (
        <Composer
          chapters={taggableChapters}
          defaultChapterId={myEntry.current_chapter_id}
          onSubmit={(input) =>
            postComment.mutate({ ...input, madeDuringReread: myEntry.is_rereading })
          }
        />
      ) : (
        <p className="rounded-lg bg-surface-alt p-3 text-xs text-muted">
          Set your current chapter to start commenting.
        </p>
      )}

      <ul className="space-y-3">
        {tree.map((node) => (
          <CommentNode
            key={node.comment.id}
            node={node}
            showChapterTag={sortPref !== 'chapter'}
            taggableChapters={taggableChapters}
            isAdmin={isAdmin}
            bookId={bookId!}
            onReply={(chapterId, body, parentId) =>
              postComment.mutate({
                chapterId,
                body,
                parentId,
                madeDuringReread: myEntry.is_rereading,
              })
            }
          />
        ))}
      </ul>

      {Boolean(lockedCount) && (
        <p className="rounded-lg bg-surface-alt p-3 text-center text-xs text-muted">
          🔒 {lockedCount} comment{lockedCount === 1 ? '' : 's'} ahead — keep
          reading to unlock
        </p>
      )}
    </div>
  )
}

type TreeNode = { comment: Comment; children: TreeNode[] }

function buildTree(comments: Comment[], sort: SortPref): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  comments.forEach((c) => byId.set(c.id, { comment: c, children: [] }))

  const roots: TreeNode[] = []
  byId.forEach((node) => {
    const parentId = node.comment.parent_id
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const byCreatedAsc = (a: TreeNode, b: TreeNode) =>
    a.comment.created_at.localeCompare(b.comment.created_at)

  byId.forEach((node) => node.children.sort(byCreatedAsc))

  if (sort === 'chapter') {
    roots.sort((a, b) => {
      const posA = a.comment.chapters?.position ?? 0
      const posB = b.comment.chapters?.position ?? 0
      return posA - posB || byCreatedAsc(a, b)
    })
  } else if (sort === 'newest') {
    roots.sort((a, b) => -byCreatedAsc(a, b))
  } else {
    // recently_unlocked (approximation): comments at a chapter you just
    // reached surface first, since there's no stored "unlocked at" moment.
    roots.sort((a, b) => {
      const posA = a.comment.chapters?.position ?? 0
      const posB = b.comment.chapters?.position ?? 0
      return posB - posA || -byCreatedAsc(a, b)
    })
  }

  return roots
}

function renderBody(body: string, blocks: Comment['spoiler_blocks']) {
  const byOrdinal = new Map(blocks.map((b) => [b.ordinal, b]))
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  SPOILER_MARKER.lastIndex = 0
  while ((match = SPOILER_MARKER.exec(body))) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index))
    }
    const ordinal = Number(match[1])
    parts.push(
      <SpoilerChip key={`spoiler-${ordinal}`} block={byOrdinal.get(ordinal)} />,
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex))

  return parts.map((part, i) => <Fragment key={i}>{part}</Fragment>)
}

function SpoilerChip({ block }: { block?: { content: string } }) {
  const [revealed, setRevealed] = useState(false)

  if (!block) {
    return (
      <span className="mx-0.5 inline-block rounded bg-surface-alt px-2 py-0.5 text-xs text-muted">
        🔒 spoiler — keep reading to unlock
      </span>
    )
  }

  return (
    <span
      onClick={() => setRevealed((r) => !r)}
      className={`mx-0.5 inline-block cursor-pointer rounded px-1.5 py-0.5 ${
        revealed ? 'bg-surface-alt' : 'select-none bg-text text-transparent'
      }`}
    >
      {block.content}
    </span>
  )
}

function CommentNode({
  node,
  showChapterTag,
  taggableChapters,
  isAdmin,
  bookId,
  onReply,
  depth = 0,
}: {
  node: TreeNode
  showChapterTag: boolean
  taggableChapters: ChapterOption[]
  isAdmin: boolean
  bookId: string
  onReply: (chapterId: string, body: string, parentId: string) => void
  depth?: number
}) {
  const { user } = useAuth()
  const [replying, setReplying] = useState(false)
  const [retagging, setRetagging] = useState(false)
  const { comment, children } = node
  const flagComment = useFlagComment(bookId)
  const resolveFlag = useResolveFlag(bookId)
  const deleteComment = useDeleteComment(bookId)
  const toggleReaction = useToggleReaction(bookId)

  const isAuthor = comment.user_id === user?.id
  const canModerate = comment.flagged && (isAuthor || isAdmin)

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
          <span className="font-semibold text-text">
            {comment.profiles?.display_name ?? 'Someone'}
          </span>
          <span className="flex items-center gap-1">
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
              onSubmit={(input) => {
                onReply(input.chapterId, input.body, comment.id)
                setReplying(false)
              }}
              compact
            />
          </div>
        )}
      </div>
      {children.length > 0 && (
        <ul className="mt-2 space-y-2">
          {children.map((child) => (
            <CommentNode
              key={child.comment.id}
              node={child}
              showChapterTag={showChapterTag}
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

type ComposerSubmit = {
  chapterId: string
  body: string
  noSpoilers?: boolean
  spoilerBlocks?: PendingSpoilerBlock[]
}

function Composer({
  chapters,
  defaultChapterId,
  onSubmit,
  compact = false,
}: {
  chapters: ChapterOption[]
  defaultChapterId: string | null
  onSubmit: (input: ComposerSubmit) => void
  compact?: boolean
}) {
  const [chapterId, setChapterId] = useState(
    defaultChapterId ?? chapters[chapters.length - 1]?.id ?? '',
  )
  const [body, setBody] = useState('')
  const [noSpoilers, setNoSpoilers] = useState(false)
  const [spoilerBlocks, setSpoilerBlocks] = useState<PendingSpoilerBlock[]>([])
  const [addingSpoiler, setAddingSpoiler] = useState(false)
  const [spoilerChapterId, setSpoilerChapterId] = useState(chapterId)
  const [spoilerText, setSpoilerText] = useState('')

  function handleInsertSpoiler() {
    if (!spoilerText.trim()) return
    const ordinal = spoilerBlocks.length + 1
    setSpoilerBlocks((blocks) => [
      ...blocks,
      { ordinal, chapterId: spoilerChapterId, content: spoilerText.trim() },
    ])
    setBody((b) => `${b}${b && !b.endsWith(' ') ? ' ' : ''}[spoiler #${ordinal}]`)
    setSpoilerText('')
    setAddingSpoiler(false)
  }

  function handleSubmit() {
    if (!body.trim() || !chapterId) return
    onSubmit({ chapterId, body: body.trim(), noSpoilers, spoilerBlocks })
    setBody('')
    setNoSpoilers(false)
    setSpoilerBlocks([])
  }

  return (
    <div className={compact ? '' : 'rounded-card bg-surface p-3'}>
      <div className="flex items-center gap-2">
        <select
          value={chapterId}
          onChange={(e) => {
            setChapterId(e.target.value)
            setSpoilerChapterId(e.target.value)
          }}
          className="min-h-11 rounded-lg border border-border bg-surface px-2 py-2 text-base"
        >
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share a thought…"
        className="mt-2 w-full rounded-lg border border-border p-2 text-base"
        rows={compact ? 2 : 3}
      />

      {addingSpoiler && (
        <div className="mt-2 rounded-lg bg-surface-alt p-2">
          <p className="text-xs font-semibold">Insert a spoiler block</p>
          <select
            value={spoilerChapterId}
            onChange={(e) => setSpoilerChapterId(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface px-2 py-2 text-base"
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            value={spoilerText}
            onChange={(e) => setSpoilerText(e.target.value)}
            placeholder="Hidden text…"
            rows={2}
            className="mt-1 w-full rounded-lg border border-border p-2 text-base"
          />
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setAddingSpoiler(false)}
              className="min-h-9 flex-1 rounded-md border border-border text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleInsertSpoiler}
              className="min-h-9 flex-1 rounded-md bg-accent text-xs font-semibold text-accent-contrast"
            >
              Insert
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-9 items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={noSpoilers}
            onChange={(e) => setNoSpoilers(e.target.checked)}
            className="size-4"
          />
          ❓ No spoilers please
        </label>
        <button
          onClick={() => setAddingSpoiler((a) => !a)}
          className="min-h-9 rounded-md px-2 py-1.5 text-xs text-accent"
        >
          🙈 Insert spoiler
        </button>
      </div>

      <button
        onClick={handleSubmit}
        className="mt-1 min-h-10 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast"
      >
        Post
      </button>
    </div>
  )
}
