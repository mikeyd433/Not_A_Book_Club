import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  useAddChapterAndAdvance,
  useChapters,
  useMyShelfEntry,
  useTaggableChapters,
  useUpsertShelfEntry,
  type ChapterOption,
} from '@/lib/books/queries'
import { celebrate } from '@/lib/celebrate'
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
import { useSearchGifs } from '@/lib/gifs/queries'
import AttachmentImage from '@/components/AttachmentImage'
import PredictionsPanel from '@/components/PredictionsPanel'
import type { MyGroup } from '@/lib/group/useMyGroup'
import type { Tables } from '@/types/database'

type Comment = Tables<'comments'> & {
  profiles: { display_name: string } | null
  chapters: { label: string; position: number } | null
  reactions: { user_id: string; emoji: string }[]
  spoiler_blocks: { id: string; ordinal: number; content: string }[]
  comment_attachments: { id: string; storage_path: string | null; gif_url: string | null }[]
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
  const taggableChapters = useTaggableChapters(bookId!)
  const addNextChapter = useAddChapterAndAdvance(bookId!)

  const isAdmin = group.role === 'admin'
  const [tab, setTab] = useState<'discussion' | 'predictions'>('discussion')
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

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-border p-0.5">
        <TabButton active={tab === 'discussion'} onClick={() => setTab('discussion')}>
          Discussion
        </TabButton>
        <TabButton active={tab === 'predictions'} onClick={() => setTab('predictions')}>
          🔮 Predictions
        </TabButton>
      </div>

      {tab === 'predictions' ? (
        <PredictionsPanel bookId={bookId!} />
      ) : taggableChapters.length === 0 ? (
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
                revealChapter(chapter.id)
              }}
              onReply={async (input, parentId) => {
                await postComment.mutateAsync({
                  ...input,
                  parentId,
                  madeDuringReread: myEntry!.is_rereading,
                })
                revealChapter(chapter.id)
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

function ChapterSection({
  chapter,
  roots,
  isRevealed,
  onReveal,
  taggableChapters,
  isAdmin,
  bookId,
  divider,
  onPost,
  onReply,
}: {
  chapter: ChapterOption
  roots: TreeNode[]
  isRevealed: boolean
  onReveal: () => void
  taggableChapters: ChapterOption[]
  isAdmin: boolean
  bookId: string
  divider: boolean
  onPost: (input: ComposerSubmit) => Promise<void>
  onReply: (input: ComposerSubmit, parentId: string) => Promise<void>
}) {
  const count = countNodes(roots)

  return (
    <div className={`space-y-3 ${divider ? 'border-t border-border pt-5' : ''}`}>
      <h2 className="text-base font-bold">{chapter.label}</h2>

      <Composer chapters={[chapter]} defaultChapterId={chapter.id} onSubmit={onPost} />

      {roots.length === 0 ? (
        <p className="text-xs text-muted">No comments yet.</p>
      ) : isRevealed ? (
        <ul className="space-y-3">
          {roots.map((node) => (
            <CommentNode
              key={node.comment.id}
              node={node}
              sectionChapterId={chapter.id}
              taggableChapters={taggableChapters}
              isAdmin={isAdmin}
              bookId={bookId}
              onReply={onReply}
            />
          ))}
        </ul>
      ) : (
        <div className="rounded-card bg-surface-alt p-3 text-center">
          <p className="text-xs text-muted">
            🙈 {count} comment{count === 1 ? '' : 's'} hidden
          </p>
          <button
            onClick={onReveal}
            className="mt-1 min-h-9 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-accent"
          >
            Reveal
          </button>
        </div>
      )}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-medium ${
        active ? 'bg-accent text-accent-contrast' : 'text-muted'
      }`}
    >
      {children}
    </button>
  )
}

type TreeNode = { comment: Comment; children: TreeNode[] }

// Builds parent/child links across every comment regardless of chapter --
// a reply can be tagged to a later chapter than the comment it replies to
// (see CommentNode's replyChapters), so nesting has to be resolved globally
// before Thread partitions the resulting roots by chapter for display.
function buildForest(comments: Comment[]): TreeNode[] {
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
  roots.sort(byCreatedAsc)

  return roots
}

function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0)
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
      </div>
      {children.length > 0 && (
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

type ComposerSubmit = {
  chapterId: string
  body: string
  noSpoilers?: boolean
  spoilerBlocks?: PendingSpoilerBlock[]
  photo?: File | null
  gifUrl?: string | null
}

function Composer({
  chapters,
  defaultChapterId,
  onSubmit,
  compact = false,
}: {
  chapters: ChapterOption[]
  defaultChapterId: string | null
  onSubmit: (input: ComposerSubmit) => Promise<void>
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
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [pickingGif, setPickingGif] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

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

  async function handleSubmit() {
    if (!body.trim() || !chapterId || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await onSubmit({ chapterId, body: body.trim(), noSpoilers, spoilerBlocks, photo, gifUrl })
      // Only clear on confirmed success -- clearing unconditionally after a
      // fire-and-forget mutate() used to silently lose the user's text (and
      // any spoiler blocks/attachment) if the request failed partway.
      setBody('')
      setNoSpoilers(false)
      setSpoilerBlocks([])
      setPhoto(null)
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
      setPhotoPreviewUrl(null)
      setGifUrl(null)
      setShowAttachMenu(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to post — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePhotoChange(file: File | null) {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhoto(file)
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null)
    if (file) setGifUrl(null) // one attachment per comment
  }

  function handlePickGif(url: string) {
    setGifUrl(url)
    handlePhotoChange(null)
    setPickingGif(false)
  }

  return (
    <div className={compact ? '' : 'rounded-card bg-surface p-3'}>
      {chapters.length > 1 && (
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
      )}
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

      {photoPreviewUrl && (
        <div className="relative mt-2 inline-block">
          <img src={photoPreviewUrl} alt="" className="max-h-40 rounded-lg" />
          <button
            onClick={() => handlePhotoChange(null)}
            className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-xs text-white"
          >
            ✕
          </button>
        </div>
      )}

      {gifUrl && (
        <div className="relative mt-2 inline-block">
          <img src={gifUrl} alt="" className="max-h-40 rounded-lg" />
          <button
            onClick={() => setGifUrl(null)}
            className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-xs text-white"
          >
            ✕
          </button>
        </div>
      )}

      {pickingGif && (
        <GifPicker onPick={handlePickGif} onCancel={() => setPickingGif(false)} />
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
        <div className="flex items-center gap-2">
          {showAttachMenu ? (
            <>
              <label className="min-h-9 cursor-pointer rounded-md px-2 py-1.5 text-xs text-accent">
                📷 Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    handlePhotoChange(e.target.files?.[0] ?? null)
                    setShowAttachMenu(false)
                  }}
                  className="hidden"
                />
              </label>
              <button
                onClick={() => {
                  setPickingGif((p) => !p)
                  setShowAttachMenu(false)
                }}
                className="min-h-9 rounded-md px-2 py-1.5 text-xs text-accent"
              >
                🎬 GIF
              </button>
              <button
                onClick={() => setShowAttachMenu(false)}
                className="min-h-9 rounded-md px-2 py-1.5 text-xs text-muted"
                aria-label="Cancel attach"
              >
                ✕
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowAttachMenu(true)}
              className="min-h-9 rounded-md px-2 py-1.5 text-xs text-accent"
            >
              📎 Attach
            </button>
          )}
          <button
            onClick={() => setAddingSpoiler((a) => !a)}
            className="min-h-9 rounded-md px-2 py-1.5 text-xs text-accent"
          >
            🙈 Insert spoiler
          </button>
        </div>
      </div>

      {submitError && (
        <p className="mt-1 text-xs text-red-600">{submitError}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-1 min-h-10 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60"
      >
        {submitting ? 'Posting…' : 'Post'}
      </button>
    </div>
  )
}

function GifPicker({
  onPick,
  onCancel,
}: {
  onPick: (url: string) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 400)
    return () => clearTimeout(id)
  }, [query])

  const { data: results, isFetching } = useSearchGifs(debounced)

  return (
    <div className="mt-2 rounded-lg bg-surface-alt p-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIFs…"
          className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-base"
        />
        <button
          onClick={onCancel}
          className="min-h-9 rounded-md border border-border px-2 py-1.5 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>

      {isFetching && <p className="mt-2 text-xs text-muted">Searching…</p>}

      {!isFetching && debounced && results?.length === 0 && (
        <p className="mt-2 text-xs text-muted">No GIFs found.</p>
      )}

      {results && results.length > 0 && (
        <div className="mt-2 grid max-h-60 grid-cols-3 gap-1.5 overflow-y-auto">
          {results.map((g) => (
            <button
              key={g.id}
              onClick={() => onPick(g.fullUrl)}
              className="overflow-hidden rounded-lg"
            >
              <img
                src={g.previewUrl}
                alt=""
                loading="lazy"
                className="h-20 w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
