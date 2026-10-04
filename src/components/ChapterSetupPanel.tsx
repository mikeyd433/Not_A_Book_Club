import { useState } from 'react'
import { useAddChapters, useChapterSnapshot, useChapters } from '@/lib/books/queries'

// The "add chapters" half of ChaptersEditor, pulled out so AddBook's
// just-created-a-book step can offer the same quick-fill/bulk-paste tools
// without duplicating them -- ChaptersEditor still owns insert/rename/
// delete/revert for an existing book's list.
export default function ChapterSetupPanel({ bookId }: { bookId: string }) {
  const { data: chapters } = useChapters(bookId)
  const addChapters = useAddChapters(bookId)
  const snapshot = useChapterSnapshot(bookId)
  // Kept as the raw typed text, not a number -- a number state forced back
  // to 0 (via Number('')) the instant the field was cleared, so a
  // controlled input bound to it could never actually show empty: clearing
  // the last digit just re-rendered a "0" right back in, making it look
  // like backspace didn't work. Parsed only where the count is actually
  // used.
  const [quickFillCount, setQuickFillCount] = useState('10')
  const [bulkText, setBulkText] = useState('')

  const nextPosition = (chapters?.[chapters.length - 1]?.position ?? 0) + 1
  const parsedQuickFillCount = Math.floor(Number(quickFillCount))
  const quickFillCountValid =
    quickFillCount.trim() !== '' && Number.isFinite(parsedQuickFillCount) && parsedQuickFillCount >= 1

  async function handleQuickFill() {
    if (!quickFillCountValid) return
    await snapshot()
    const start = nextPosition
    await addChapters.mutateAsync(
      Array.from({ length: parsedQuickFillCount }, (_, i) => ({
        position: start + i,
        label: `Chapter ${start + i}`,
      })),
    )
  }

  async function handleBulkPaste() {
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    await snapshot()
    const start = nextPosition
    await addChapters.mutateAsync(
      lines.map((label, i) => ({ position: start + i, label })),
    )
    setBulkText('')
  }

  return (
    <div className="rounded-card bg-surface p-3" data-tour="chapter-setup-panel">
      <p className="text-sm font-semibold">Add chapters</p>
      <p className="mt-1 text-xs text-muted">
        Paste a table of contents (one label per line), or just add generic
        "Chapter N" placeholders to fill in later.
      </p>
      <textarea
        value={bulkText}
        onChange={(e) => setBulkText(e.target.value)}
        placeholder={'One chapter label per line, e.g.\nPrologue\nChapter 1\nChapter 2'}
        className="mt-2 h-28 w-full rounded-lg border border-border p-2 text-base"
      />
      <button
        onClick={handleBulkPaste}
        disabled={!bulkText.trim()}
        className="mt-2 min-h-11 w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60"
      >
        Append pasted chapters
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-xs text-muted">or add</span>
        <input
          type="number"
          min={1}
          value={quickFillCount}
          onChange={(e) => setQuickFillCount(e.target.value)}
          className="min-h-11 w-20 rounded-lg border border-border px-2 py-2 text-base"
        />
        <button
          onClick={handleQuickFill}
          disabled={!quickFillCountValid}
          className="min-h-11 flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60"
        >
          generic "Chapter N" placeholders
        </button>
      </div>
    </div>
  )
}
