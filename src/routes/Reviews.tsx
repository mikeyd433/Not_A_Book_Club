import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useChapters, useFullAccess, useMyShelfEntry } from '@/lib/books/queries'
import { useComments } from '@/lib/comments/queries'
import {
  useDeleteRating,
  usePostRating,
  useRatings,
  useUpdateRating,
} from '@/lib/ratings/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { MyGroup } from '@/lib/group/useMyGroup'
import type { Tables } from '@/types/database'

type Rating = Tables<'ratings'> & { profiles: { display_name: string } | null }

function Stars({ value }: { value: number }) {
  return <span aria-label={`${value} stars`}>{'★'.repeat(value)}{'☆'.repeat(5 - value)}</span>
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1 text-2xl">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="min-h-11 min-w-11 leading-none"
          aria-label={`${n} stars`}
        >
          {n <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

// Shared by all three places a rating gets written (first rating, editing
// one, re-rating after a reread) -- previously each had its own near-
// identical star-picker + textarea + save button block.
function RatingForm({
  title,
  note,
  initialStars,
  initialReview,
  saveLabel = 'Save',
  onCancel,
  onSave,
}: {
  title?: string
  note?: string
  initialStars: number
  initialReview: string
  saveLabel?: string
  onCancel?: () => void
  onSave: (stars: number, review: string) => void
}) {
  const [stars, setStars] = useState(initialStars)
  const [review, setReview] = useState(initialReview)

  return (
    <div className="rounded-card bg-surface p-3">
      {title && <p className="text-sm font-semibold">{title}</p>}
      {note && <p className="text-xs text-muted">{note}</p>}
      <div className={title || note ? 'mt-2' : ''}>
        <StarPicker value={stars} onChange={setStars} />
      </div>
      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        placeholder="Write a review (optional)…"
        rows={3}
        className="mt-2 w-full rounded-lg border border-border p-2 text-base"
      />
      <div className="mt-2 flex gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="min-h-10 flex-1 rounded-lg border border-border text-sm font-semibold"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => onSave(stars, review)}
          className={`min-h-10 ${onCancel ? 'flex-1' : 'w-full'} rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast`}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

export default function Reviews({ group: _group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
  const { user } = useAuth()
  const { data: chapters } = useChapters(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const { data: ratings } = useRatings(bookId!)
  const { data: comments } = useComments(bookId!)
  const postRating = usePostRating(bookId!)
  const updateRating = useUpdateRating(bookId!)
  const deleteRating = useDeleteRating(bookId!)

  const [formMode, setFormMode] = useState<'closed' | 'edit' | 'new'>('closed')
  const fullAccess = useFullAccess(bookId!)

  const typedRatings = useMemo(() => (ratings ?? []) as Rating[], [ratings])
  const myRatings = typedRatings.filter((r) => r.user_id === user?.id)
  const latestMine = myRatings[0] // already ordered newest-first
  const othersRatings = typedRatings.filter((r) => r.user_id !== user?.id)

  const summary = useMemo(() => {
    const latestByUser = new Map<string, Rating>()
    for (const r of typedRatings) {
      if (!latestByUser.has(r.user_id)) latestByUser.set(r.user_id, r)
    }
    const all = [...latestByUser.values()]
    const finished = all.filter((r) => !r.is_dnf)
    const dnf = all.filter((r) => r.is_dnf)
    const avg = (rows: Rating[]) =>
      rows.length ? rows.reduce((s, r) => s + r.stars, 0) / rows.length : null
    return {
      finishedAvg: avg(finished),
      finishedCount: finished.length,
      dnfAvg: avg(dnf),
      dnfCount: dnf.length,
    }
  }, [typedRatings])

  const heatmap = useMemo(() => {
    if (!chapters) return []
    const counts = new Map<string, number>()
    for (const c of comments ?? []) {
      if (!c.chapter_id) continue
      counts.set(c.chapter_id, (counts.get(c.chapter_id) ?? 0) + c.reactions.length)
    }
    const rows = chapters.map((c) => ({
      id: c.id,
      label: c.label,
      position: c.position,
      count: counts.get(c.id) ?? 0,
    }))
    const max = Math.max(1, ...rows.map((r) => r.count))
    return rows.map((r) => ({ ...r, pct: Math.round((r.count / max) * 100) }))
  }, [chapters, comments])

  function handleSaveNew(stars: number, review: string) {
    postRating.mutate({
      stars,
      review: review.trim() || null,
      isDnf: myEntry?.status === 'dnf',
      isReread: Boolean(myEntry?.is_rereading),
    })
    setFormMode('closed')
  }

  function handleSaveEdit(stars: number, review: string) {
    if (!latestMine) return
    updateRating.mutate({ ratingId: latestMine.id, stars, review: review.trim() || null })
    setFormMode('closed')
  }

  if (!myEntry) {
    return (
      <p className="rounded-card bg-surface p-4 text-sm text-muted">
        Add this book to your shelf to rate and review it once you've finished.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">⭐ Reviews</h1>

      {!fullAccess ? (
        <p className="rounded-lg bg-surface-alt p-3 text-xs text-muted">
          Finish the book (or DNF with "Spoil me") to rate and review it, and
          to see everyone else's.
        </p>
      ) : formMode === 'edit' && latestMine ? (
        <RatingForm
          initialStars={latestMine.stars}
          initialReview={latestMine.review ?? ''}
          onCancel={() => setFormMode('closed')}
          onSave={handleSaveEdit}
        />
      ) : formMode === 'new' ? (
        <RatingForm
          note={
            latestMine
              ? "Starting a fresh entry — your earlier rating is kept."
              : undefined
          }
          initialStars={5}
          initialReview=""
          onCancel={() => setFormMode('closed')}
          onSave={handleSaveNew}
        />
      ) : latestMine ? (
        <div className="rounded-card bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="text-lg text-accent">
              <Stars value={latestMine.stars} />
            </span>
            {latestMine.is_dnf && (
              <span className="text-xs text-muted">DNF rating</span>
            )}
            {latestMine.is_reread && (
              <span className="text-xs text-muted">🔁 reread rating</span>
            )}
          </div>
          {latestMine.review && (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {latestMine.review}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setFormMode('edit')}
              className="min-h-9 rounded-full border border-border px-3 py-1.5 text-xs font-medium"
            >
              Edit
            </button>
            {myEntry.is_rereading && (
              <button
                onClick={() => setFormMode('new')}
                className="min-h-9 rounded-full border border-border px-3 py-1.5 text-xs font-medium"
              >
                🔁 Rate again after this reread
              </button>
            )}
            <button
              onClick={() => {
                if (window.confirm('Delete your rating?')) {
                  deleteRating.mutate(latestMine.id)
                }
              }}
              className="min-h-9 rounded-md px-3 py-1.5 text-xs text-red-600"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <RatingForm
          title="Rate this book"
          initialStars={5}
          initialReview=""
          saveLabel="Save rating"
          onSave={handleSaveNew}
        />
      )}

      {fullAccess && (
        <div className="rounded-card bg-surface p-3">
          <h2 className="text-sm font-semibold">Group average</h2>
          <p className="mt-1 text-sm">
            {summary.finishedCount > 0
              ? `★ ${summary.finishedAvg!.toFixed(1)} (${summary.finishedCount} finished)`
              : 'No finished ratings yet.'}
          </p>
          {summary.dnfCount > 0 && (
            <p className="mt-0.5 text-xs text-muted">
              DNF ratings: ★ {summary.dnfAvg!.toFixed(1)} ({summary.dnfCount})
            </p>
          )}
        </div>
      )}

      {fullAccess && othersRatings.length > 0 && (
        <ul className="space-y-2">
          {othersRatings.map((r) => (
            <li key={r.id} className="rounded-card bg-surface p-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-semibold text-text">
                  {r.profiles?.display_name ?? 'Someone'}
                </span>
                <span className="flex items-center gap-1">
                  {r.is_dnf && <span>DNF</span>}
                  {r.is_reread && <span>🔁</span>}
                </span>
              </div>
              <p className="mt-1 text-accent">
                <Stars value={r.stars} />
              </p>
              {r.review && (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                  {r.review}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {fullAccess && heatmap.length > 0 && (
        <div className="rounded-card bg-surface p-3">
          <h2 className="text-sm font-semibold">Chapter reaction heatmap</h2>
          <ul className="mt-2 space-y-1.5">
            {heatmap.map((row) => (
              <li key={row.id} className="text-xs">
                <div className="flex items-center justify-between text-muted">
                  <span>{row.label}</span>
                  <span>{row.count}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
