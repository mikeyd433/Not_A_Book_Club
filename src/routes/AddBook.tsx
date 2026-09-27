import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchOpenLibrary, type OpenLibraryResult } from '@/lib/openLibrary'
import { useAddBook } from '@/lib/books/queries'
import type { MyGroup } from '@/lib/group/useMyGroup'

export default function AddBook({ group }: { group: MyGroup }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OpenLibraryResult[]>([])
  const [searching, setSearching] = useState(false)
  const addBook = useAddBook(group.id)

  async function handleSearch() {
    setSearching(true)
    try {
      setResults(await searchOpenLibrary(query))
    } finally {
      setSearching(false)
    }
  }

  async function handleAdd(result: OpenLibraryResult) {
    const book = await addBook.mutateAsync({
      title: result.title,
      author: result.author,
      openLibraryId: result.openLibraryId,
      openLibraryCoverUrl: result.coverUrl,
    })
    navigate(`/book/${book.id}`)
  }

  async function handleAddManual() {
    const book = await addBook.mutateAsync({
      title: query,
      author: null,
      openLibraryId: null,
      openLibraryCoverUrl: null,
    })
    navigate(`/book/${book.id}`)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Add a book</h1>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by title or author…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="min-h-11 shrink-0 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-accent-contrast disabled:opacity-60"
        >
          Search
        </button>
      </div>

      <ul className="space-y-2">
        {results.map((result) => (
          <li
            key={result.openLibraryId}
            className="flex items-center gap-3 rounded-card bg-surface p-3"
          >
            {result.coverUrl ? (
              <img
                src={result.coverUrl}
                alt=""
                className="h-16 w-11 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="h-16 w-11 shrink-0 rounded bg-surface-alt" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{result.title}</p>
              <p className="truncate text-xs text-muted">{result.author}</p>
            </div>
            <button
              onClick={() => handleAdd(result)}
              disabled={addBook.isPending}
              className="min-h-10 shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast"
            >
              Add
            </button>
          </li>
        ))}
      </ul>

      {query && results.length === 0 && !searching && (
        <button
          onClick={handleAddManual}
          disabled={addBook.isPending}
          className="min-h-11 w-full rounded-lg border border-dashed border-border py-3 text-sm text-muted"
        >
          Can't find it? Add "{query}" manually
        </button>
      )}
    </div>
  )
}
