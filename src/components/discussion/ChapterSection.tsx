import type { ChapterOption } from '@/lib/books/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import { countNodes, type TreeNode } from '@/lib/discussion/forest'
import CommentNode from './CommentNode'
import Composer, { type ComposerSubmit } from './Composer'

export default function ChapterSection({
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
  const { user } = useAuth()
  // While hidden, posting multiple comments shouldn't require revealing
  // everyone else's just to keep track of your own -- only other people's
  // comments count toward "hidden" and get held back from view.
  const myRoots = roots.filter((r) => r.comment.user_id === user?.id)
  const otherRoots = roots.filter((r) => r.comment.user_id !== user?.id)
  const hiddenCount = countNodes(otherRoots)

  return (
    <div className={`space-y-2 ${divider ? 'border-t border-border pt-4' : ''}`}>
      <h2 className="text-base font-bold">{chapter.label}</h2>

      <Composer chapters={[chapter]} defaultChapterId={chapter.id} onSubmit={onPost} />

      {isRevealed ? (
        roots.length > 0 && (
          <ul>
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
        )
      ) : (
        <>
          {myRoots.length > 0 && (
            <ul>
              {myRoots.map((node) => (
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
          )}
          {hiddenCount > 0 && (
            <div className="rounded-card bg-surface-alt p-3 text-center">
              <p className="text-xs text-muted">
                🙈 {hiddenCount} comment{hiddenCount === 1 ? '' : 's'} hidden
              </p>
              <button
                onClick={onReveal}
                className="mt-1 min-h-9 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-accent"
              >
                Reveal
              </button>
            </div>
          )}
        </>
      )}

      {roots.length === 0 && <p className="text-xs text-muted">No comments yet.</p>}
    </div>
  )
}
