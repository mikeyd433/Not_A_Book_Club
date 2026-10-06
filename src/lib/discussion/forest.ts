import type { Tables } from '@/types/database'

export type Comment = Tables<'comments'> & {
  profiles: {
    display_name: string
    avatar_url: string | null
    avatar_updated_at: string | null
  } | null
  chapters: { label: string; position: number } | null
  reactions: { user_id: string; emoji: string }[]
  spoiler_blocks: { id: string; ordinal: number; content: string }[]
  comment_attachments: { id: string; storage_path: string | null; gif_url: string | null }[]
}

export type TreeNode = { comment: Comment; children: TreeNode[] }

// Builds parent/child links across every comment regardless of chapter --
// a reply can be tagged to a later chapter than the comment it replies to
// (see CommentNode's replyChapters), so nesting has to be resolved globally
// before Thread partitions the resulting roots by chapter for display.
export function buildForest(comments: Comment[]): TreeNode[] {
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

export function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0)
}
