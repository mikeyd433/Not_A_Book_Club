import { describe, expect, it } from 'vitest'
import { buildForest, countNodes, type Comment } from './forest'

function makeComment(overrides: Partial<Comment> & { id: string }): Comment {
  return {
    book_id: 'book-1',
    chapter_id: 'ch-1',
    user_id: 'user-1',
    parent_id: null,
    body: 'hello',
    created_at: '2026-01-01T00:00:00Z',
    no_spoilers: false,
    made_during_reread: false,
    is_prediction: false,
    flagged: false,
    profiles: { display_name: 'Someone', avatar_url: null, avatar_updated_at: null },
    chapters: { label: 'Chapter 1', position: 1 },
    reactions: [],
    spoiler_blocks: [],
    comment_attachments: [],
    ...overrides,
  } as Comment
}

describe('buildForest', () => {
  it('puts comments with no parent at the root', () => {
    const roots = buildForest([
      makeComment({ id: 'a', created_at: '2026-01-01T00:00:00Z' }),
      makeComment({ id: 'b', created_at: '2026-01-02T00:00:00Z' }),
    ])
    expect(roots.map((r) => r.comment.id)).toEqual(['a', 'b'])
  })

  it('nests a reply under its parent regardless of chapter', () => {
    const roots = buildForest([
      makeComment({ id: 'parent', chapter_id: 'ch-1' }),
      makeComment({ id: 'reply', parent_id: 'parent', chapter_id: 'ch-2' }),
    ])
    expect(roots).toHaveLength(1)
    expect(roots[0].children.map((c) => c.comment.id)).toEqual(['reply'])
  })

  it('treats a comment whose parent is missing (e.g. deleted) as a root', () => {
    const roots = buildForest([
      makeComment({ id: 'orphan', parent_id: 'does-not-exist' }),
    ])
    expect(roots.map((r) => r.comment.id)).toEqual(['orphan'])
  })

  it('sorts roots and children by created_at ascending', () => {
    const roots = buildForest([
      makeComment({ id: 'later', created_at: '2026-01-02T00:00:00Z' }),
      makeComment({ id: 'earlier', created_at: '2026-01-01T00:00:00Z' }),
      makeComment({
        id: 'reply-later',
        parent_id: 'earlier',
        created_at: '2026-01-03T00:00:00Z',
      }),
      makeComment({
        id: 'reply-earlier',
        parent_id: 'earlier',
        created_at: '2026-01-01T12:00:00Z',
      }),
    ])
    expect(roots.map((r) => r.comment.id)).toEqual(['earlier', 'later'])
    const earlierNode = roots.find((r) => r.comment.id === 'earlier')!
    expect(earlierNode.children.map((c) => c.comment.id)).toEqual([
      'reply-earlier',
      'reply-later',
    ])
  })
})

describe('countNodes', () => {
  it('counts a flat list', () => {
    const roots = buildForest([makeComment({ id: 'a' }), makeComment({ id: 'b' })])
    expect(countNodes(roots)).toBe(2)
  })

  it('counts nested replies too', () => {
    const roots = buildForest([
      makeComment({ id: 'a' }),
      makeComment({ id: 'reply', parent_id: 'a' }),
      makeComment({ id: 'reply-reply', parent_id: 'reply' }),
    ])
    expect(countNodes(roots)).toBe(3)
  })

  it('returns 0 for an empty list', () => {
    expect(countNodes([])).toBe(0)
  })
})
