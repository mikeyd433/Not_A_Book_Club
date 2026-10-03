// A failed query and an empty result look identical to users unless
// something says otherwise -- this is what the ambiguous-embed bug (see
// comments/queries.ts) hid behind for days. Drop this in wherever a
// blocking query's failure would otherwise just render as "nothing here."
export default function QueryError({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  const message = error instanceof Error ? error.message : 'Something went wrong.'

  return (
    <div className="rounded-card bg-surface p-4 text-center">
      <p className="text-sm font-semibold text-red-600">Couldn't load this.</p>
      <p className="mt-1 text-xs text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-accent"
        >
          Try again
        </button>
      )}
    </div>
  )
}
