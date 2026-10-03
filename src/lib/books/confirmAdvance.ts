import type { ChapterOption } from './queries'

// Dragging the wheel picker makes it easy to fling past several chapters by
// accident -- each one may hold spoilers for content not read yet, so any
// forward move gets a plain window.confirm (matching the rest of the app's
// confirmation style) before it's committed. Moving backward, or setting a
// position for the first time (fromPosition undefined -- nothing to skip
// past), needs no confirmation.
export function confirmAdvance(
  chapters: ChapterOption[],
  fromPosition: number | undefined,
  toChapter: ChapterOption,
): boolean {
  if (fromPosition === undefined || toChapter.position <= fromPosition) return true

  const skipped = chapters
    .filter((c) => c.position > fromPosition && c.position < toChapter.position)
    .map((c) => c.label)

  const message =
    skipped.length === 0
      ? `Advance to ${toChapter.label}?`
      : `Advance past ${joinWithAnd(skipped)} to ${toChapter.label}?`

  return window.confirm(message)
}

function joinWithAnd(items: string[]): string {
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}
