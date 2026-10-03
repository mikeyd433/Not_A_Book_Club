import { useEffect, useState } from 'react'
import { useSearchGifs } from '@/lib/gifs/queries'

export default function GifPicker({
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

  const { data: results, isFetching, isError } = useSearchGifs(debounced)

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

      {isError && (
        <p className="mt-2 text-xs text-red-600">
          GIF search failed — try again in a moment.
        </p>
      )}

      {!isFetching && !isError && debounced && results?.length === 0 && (
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
