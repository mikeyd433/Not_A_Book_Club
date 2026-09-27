export default function ProgressBar({
  current,
  total,
}: {
  current: number
  total: number
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
        {total > 0 ? `Ch. ${current} of ${total}` : 'No chapters yet'}
      </p>
    </div>
  )
}
