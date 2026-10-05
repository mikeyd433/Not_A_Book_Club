export default function ProgressBar({
  current,
  total,
  currentLabel,
}: {
  // 1-based rank among the sorted chapters -- only used for the bar's fill
  // percentage, not shown as a number itself (see currentLabel below).
  current: number
  total: number
  // The current chapter's own label (e.g. "Chapter 2"), named directly
  // instead of a "Ch. {current} of {total}" count -- current is just the
  // chapter's rank in the list, which only matches its label's number by
  // coincidence (a book with a Prologue, or one whose chapters were
  // reordered, breaks that), and a bare count doesn't say anything a
  // reader recognizes anyway. Undefined when there's no chapter selected
  // yet (want_to_read, or reading with no position set).
  currentLabel?: string
}) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0

  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted">
        {total === 0
          ? 'No chapters yet'
          : currentLabel
            ? `Now reading ${currentLabel}`
            : 'Not started yet'}
      </p>
    </div>
  )
}
