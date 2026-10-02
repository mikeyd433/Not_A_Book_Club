import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchOpenLibrary, type OpenLibraryResult } from '@/lib/openLibrary'
import { useAddBook, useMyShelfEntry, useUpsertShelfEntry } from '@/lib/books/queries'
import ChapterSetupPanel from '@/components/ChapterSetupPanel'
import CoverUploadPanel from '@/components/CoverUploadPanel'
import type { MyGroup } from '@/lib/group/useMyGroup'
import type { Tables } from '@/types/database'

type Book = Tables<'books'>

export default function AddBook({ group }: { group: MyGroup }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OpenLibraryResult[]>([])
  const [searching, setSearching] = useState(false)
  const [createdBook, setCreatedBook] = useState<Book | null>(null)
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
    setCreatedBook(book)
  }

  async function handleAddManual() {
    const book = await addBook.mutateAsync({
      title: query,
      author: null,
      openLibraryId: null,
      openLibraryCoverUrl: null,
    })
    setCreatedBook(book)
  }

  if (createdBook) {
    return (
      <BookSetupStep
        book={createdBook}
        onDone={() => navigate(`/book/${createdBook.id}`)}
      />
    )
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
                className="h-16 w-11 shrink-0 object-cover"
              />
            ) : (
              <div className="h-16 w-11 shrink-0 bg-surface-alt" />
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

// Chapters can only be added by someone currently reading/paused on the
// book (RLS requires it, same as ChaptersEditor's own canEdit check) --
// a book you *just* created has no shelf entry at all yet, so this offers
// one tap to mark yourself as reading before handing off to the real
// chapter-setup tool. Covers have no such restriction, so that panel is
// always available.
function BookSetupStep({ book, onDone }: { book: Book; onDone: () => void }) {
  const { data: myEntry } = useMyShelfEntry(book.id)
  const upsertShelf = useUpsertShelfEntry(book.id)
  const canEditChapters = myEntry?.status === 'reading' || myEntry?.status === 'paused'

  return (
    <div className="space-y-5">
      <div className="rounded-card bg-surface p-3">
        <p className="text-sm font-semibold">✅ Added "{book.title}"</p>
        <p className="mt-1 text-xs text-muted">
          Set up chapters and a cover now, or skip — you can always do this
          later from the book's own Chapters and Covers tabs.
        </p>
      </div>

      {myEntry !== undefined &&
        (canEditChapters ? (
          <ChapterSetupPanel bookId={book.id} />
        ) : (
          <div className="rounded-card bg-surface p-3">
            <p className="text-sm font-semibold">Chapters</p>
            <p className="mt-1 text-xs text-muted">
              Mark yourself as reading this book to set up its chapters now.
            </p>
            <button
              onClick={() => upsertShelf.mutate({ status: 'reading' })}
              disabled={upsertShelf.isPending}
              className="mt-2 min-h-11 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60"
            >
              📖 I'm reading this — set up chapters
            </button>
          </div>
        ))}

      <CoverUploadPanel bookId={book.id} />

      <button
        onClick={onDone}
        className="min-h-11 w-full rounded-lg border border-border px-4 py-3 text-sm font-semibold"
      >
        Done — go to book →
      </button>
    </div>
  )
}
