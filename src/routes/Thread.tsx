import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import {
  useChapters,
  useMyShelfEntry,
  useTaggableChapters,
  useUpsertShelfEntry,
  type ChapterOption,
} from '@/lib/books/queries'
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
import type { SortPref } from '@/types/domain'
import type { Tables } from '@/types/database'

type Comment = Tables<'comments'> & {
  profiles: { display_name: string } | null
  chapters: { label: string; position: number } | null
  reactions: { user_id: string; emoji: string }[]
  spoiler_blocks: { id: string; ordinal: number; content: string }[]
  comment_attachments: { id: string; storage_path: string | null; gif_url: string | null }[]
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
  const taggableChapters = useTaggableChapters(bookId!)

  const sortPref = (myEntry?.sort_pref ?? 'chapter') as SortPref
  const isAdmin = group.role === 'admin'
  const [tab, setTab] = useState<'discussion' | 'predictions'>('discussion')

  // Landing on Discussion is now the default entry point from Home, before
  // anyone has necessarily visited Overview to set a reading position --
  // but is_chapter_unlocked has nothing to compare against without one, so
  // with no position set literally nothing unlocks, not even chapter 1.
  // Default to chapter 1 (creating a shelf entry if there isn't one yet)
  // until the member explicitly sets a real position via Overview's
  // chapter picker; from then on their actual position always wins.
  const autoDefaultedRef = useRef<string | null>(null)
  useEffect(() => {
    if (autoDefaultedRef.current === bookId) return
    if (!chapters || chapters.length === 0) return
    if (myEntry === undefined) return
    if (myEntry?.current_chapter_id) return
    autoDefaultedRef.current = bookId!
    upsertShelf.mutate({ current_chapter_id: chapters[0].id })
  }, [bookId, chapters, myEntry, upsertShelf])

  const tree = useMemo(
    () => buildTree((comments ?? []) as Comment[], sortPref),
    [comments, sortPref],
  )

  if (myEntry === undefined || chapters === undefined) {
    return <p className="text-sm text-muted">Loading…</p>
  }

  if (chapters.length === 0) {
    return (
      <p className="rounded-card bg-surface p-4 text-sm text-muted">
        This book doesn't have any chapters yet — add some from the Chapters
        tab.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
          <TabButton active={tab === 'discussion'} onClick={() => setTab('discussion')}>
            Discussion
          </TabButton>
          <TabButton active={tab === 'predictions'} onClick={() => setTab('predictions')}>
            🔮 Predictions
          </TabButton>
        </div>
        {tab === 'discussion' && (
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
        )}
      </div>

      {tab === 'predictions' ? (
        <PredictionsPanel bookId={bookId!} />
      ) : (
        <>
          {taggableChapters.length > 0 ? (
            <Composer
              chapters={taggableChapters}
              defaultChapterId={myEntry!.current_chapter_id}
              onSubmit={(input) =>
                postComment.mutate({ ...input, madeDuringReread: myEntry!.is_rereading })
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
                onReply={(chapterId, body, parentId, photo, gifUrl) =>
                  postComment.mutate({
                    chapterId,
                    body,
                    parentId,
                    photo,
                    gifUrl,
                    madeDuringReread: myEntry!.is_rereading,
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
        </>
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
  onReply: (
    chapterId: string,
    body: string,
    parentId: string,
    photo?: File | null,
    gifUrl?: string | null,
  ) => void
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
              onSubmit={(input) => {
                onReply(input.chapterId, input.body, comment.id, input.photo, input.gifUrl)
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
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [pickingGif, setPickingGif] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)

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
    onSubmit({ chapterId, body: body.trim(), noSpoilers, spoilerBlocks, photo, gifUrl })
    setBody('')
    setNoSpoilers(false)
    setSpoilerBlocks([])
    setPhoto(null)
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoPreviewUrl(null)
    setGifUrl(null)
    setShowAttachMenu(false)
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

      <button
        onClick={handleSubmit}
        className="mt-1 min-h-10 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast"
      >
        Post
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
