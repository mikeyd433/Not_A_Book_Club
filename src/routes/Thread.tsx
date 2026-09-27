import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useChapters, useMyShelfEntry, useUpsertShelfEntry } from '@/lib/books/queries'
import {
  useComments,
  useLockedCommentCount,
  usePostComment,
} from '@/lib/comments/queries'
import type { MyGroup } from '@/lib/group/useMyGroup'
import type { SortPref } from '@/types/domain'
import type { Tables } from '@/types/database'

type Comment = Tables<'comments'> & {
  profiles: { display_name: string } | null
  chapters: { label: string; position: number } | null
}

const SORT_LABELS: Record<Exclude<SortPref, 'most_reactions'>, string> = {
  chapter: 'Chapter order',
  newest: 'Newest first',
  recently_unlocked: 'Recently unlocked',
}

export default function Thread({ group: _group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
  const { data: chapters } = useChapters(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const { data: comments } = useComments(bookId!)
  const { data: lockedCount } = useLockedCommentCount(bookId!)
  const upsertShelf = useUpsertShelfEntry(bookId!)
  const postComment = usePostComment(bookId!)

  const sortPref = (myEntry?.sort_pref ?? 'chapter') as SortPref

  const taggableChapters = useMemo(() => {
    if (!chapters || !myEntry) return []
    const fullAccess =
      myEntry.status === 'finished' ||
      myEntry.status === 'read_before_joining' ||
      (myEntry.status === 'dnf' && myEntry.spoil_me)

    if (fullAccess) return chapters

    const currentPosition = chapters.find(
      (c) => c.id === myEntry.current_chapter_id,
    )?.position
    if (currentPosition === undefined) return []
    return chapters.filter((c) => c.position <= currentPosition)
  }, [chapters, myEntry])

  const tree = useMemo(() => buildTree(comments ?? [], sortPref), [comments, sortPref])

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
          onSubmit={(chapterId, body) =>
            postComment.mutate({ chapterId, body })
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
            onReply={(chapterId, body, parentId) =>
              postComment.mutate({ chapterId, body, parentId })
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

function CommentNode({
  node,
  showChapterTag,
  taggableChapters,
  onReply,
  depth = 0,
}: {
  node: TreeNode
  showChapterTag: boolean
  taggableChapters: { id: string; label: string }[]
  onReply: (chapterId: string, body: string, parentId: string) => void
  depth?: number
}) {
  const [replying, setReplying] = useState(false)
  const { comment, children } = node

  return (
    <li className={depth > 0 ? 'ml-4 border-l border-border pl-3' : ''}>
      <div className="rounded-card bg-surface p-3">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-semibold text-text">
            {comment.profiles?.display_name ?? 'Someone'}
          </span>
          <span className="flex items-center gap-1">
            {comment.made_during_reread && <span title="Posted during a reread">🔁</span>}
            {showChapterTag && comment.chapters && (
              <span className="rounded-full bg-surface-alt px-2 py-0.5">
                Ch. {comment.chapters.position}
              </span>
            )}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">
          {comment.body}
        </p>
        <button
          onClick={() => setReplying((r) => !r)}
          className="-ml-2 min-h-9 rounded-md px-2 py-1.5 text-xs text-accent active:bg-surface-alt"
        >
          Reply
        </button>
        {replying && (
          <div className="mt-2">
            <Composer
              chapters={taggableChapters}
              defaultChapterId={comment.chapter_id}
              onSubmit={(chapterId, body) => {
                onReply(chapterId, body, comment.id)
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
              onReply={onReply}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function Composer({
  chapters,
  defaultChapterId,
  onSubmit,
  compact = false,
}: {
  chapters: { id: string; label: string }[]
  defaultChapterId: string | null
  onSubmit: (chapterId: string, body: string) => void
  compact?: boolean
}) {
  const [chapterId, setChapterId] = useState(
    defaultChapterId ?? chapters[chapters.length - 1]?.id ?? '',
  )
  const [body, setBody] = useState('')

  function handleSubmit() {
    if (!body.trim() || !chapterId) return
    onSubmit(chapterId, body.trim())
    setBody('')
  }

  return (
    <div className={compact ? '' : 'rounded-card bg-surface p-3'}>
      <div className="flex items-center gap-2">
        <select
          value={chapterId}
          onChange={(e) => setChapterId(e.target.value)}
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
      <button
        onClick={handleSubmit}
        className="mt-1 min-h-10 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast"
      >
        Post
      </button>
    </div>
  )
}
