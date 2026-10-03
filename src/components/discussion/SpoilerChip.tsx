import { Fragment, useState, type ReactNode } from 'react'
import type { Comment } from '@/lib/discussion/forest'

const SPOILER_MARKER = /\[spoiler #(\d+)\]/g

export function renderBody(body: string, blocks: Comment['spoiler_blocks']) {
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

export default function SpoilerChip({ block }: { block?: { content: string } }) {
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
