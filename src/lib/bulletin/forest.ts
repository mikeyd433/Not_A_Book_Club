import type { Tables } from '@/types/database'

export type Post = Tables<'group_posts'> & {
  profiles: {
    display_name: string
    avatar_url: string | null
    avatar_updated_at: string | null
  } | null
  group_post_reactions: { user_id: string; emoji: string }[]
  group_post_attachments: { id: string; storage_path: string | null; gif_url: string | null }[]
}

export type TreeNode = { post: Post; children: TreeNode[] }

export function buildForest(posts: Post[]): TreeNode[] {
  const byId = new Map<string, TreeNode>()
  posts.forEach((p) => byId.set(p.id, { post: p, children: [] }))

  const roots: TreeNode[] = []
  byId.forEach((node) => {
    const parentId = node.post.parent_id
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const byCreatedAsc = (a: TreeNode, b: TreeNode) =>
    a.post.created_at.localeCompare(b.post.created_at)

  byId.forEach((node) => node.children.sort(byCreatedAsc))
  roots.sort(byCreatedAsc)

  return roots
}

export function countNodes(nodes: TreeNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0)
}
