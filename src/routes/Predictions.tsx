import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useChapters, useMyShelfEntry } from '@/lib/books/queries'
import {
  useDeletePrediction,
  usePostPrediction,
  usePredictionScoreboard,
  usePredictions,
  useResolvePrediction,
} from '@/lib/predictions/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import type { MyGroup } from '@/lib/group/useMyGroup'
import type { Tables } from '@/types/database'

type ChapterOption = { id: string; label: string; position: number }

type Prediction = Tables<'predictions'> & {
  profiles: { display_name: string } | null
  chapters: { label: string; position: number } | null
}

const VERDICT_LABELS: Record<string, string> = {
  correct: '✅ Correct',
  incorrect: '❌ Incorrect',
  unclear: '🤷 Unclear',
}

export default function Predictions({ group: _group }: { group: MyGroup }) {
  const { bookId } = useParams<{ bookId: string }>()
  const { user } = useAuth()
  const { data: chapters } = useChapters(bookId!)
  const { data: myEntry } = useMyShelfEntry(bookId!)
  const { data: predictions } = usePredictions(bookId!)
  const { data: scoreboard } = usePredictionScoreboard(bookId!)
  const postPrediction = usePostPrediction(bookId!)
  const resolvePrediction = useResolvePrediction(bookId!)
  const deletePrediction = useDeletePrediction(bookId!)

  const [chapterId, setChapterId] = useState('')
  const [body, setBody] = useState('')

  const fullAccess = Boolean(
    myEntry &&
      (myEntry.status === 'read_before_joining' ||
        (myEntry.status === 'finished' && (!myEntry.is_rereading || myEntry.spoil_me)) ||
        (myEntry.status === 'dnf' && myEntry.spoil_me)),
  )

  const taggableChapters = useMemo<ChapterOption[]>(() => {
    if (!chapters || !myEntry) return []
    if (fullAccess) return chapters

    const currentPosition = chapters.find(
      (c) => c.id === myEntry.current_chapter_id,
    )?.position
    if (currentPosition === undefined) return []
    return chapters.filter((c) => c.position <= currentPosition)
  }, [chapters, myEntry, fullAccess])

  const activeChapterId = chapterId || taggableChapters[taggableChapters.length - 1]?.id || ''

  function handleSubmit() {
    if (!body.trim() || !activeChapterId) return
    postPrediction.mutate({ chapterId: activeChapterId, body: body.trim() })
    setBody('')
    setChapterId('')
  }

  if (!myEntry) {
    return (
      <p className="rounded-card bg-surface p-4 text-sm text-muted">
        Add this book to your shelf and set a chapter to make predictions.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">🔮 Predictions</h1>

      {myEntry.is_rereading ? (
        <p className="rounded-lg bg-surface-alt p-3 text-xs text-muted">
          Predictions aren't available while rereading — you already know how
          this one goes.
        </p>
      ) : taggableChapters.length > 0 ? (
        <div className="rounded-card bg-surface p-3">
          <select
            value={activeChapterId}
            onChange={(e) => setChapterId(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-2 py-2 text-base"
          >
            {taggableChapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What do you think happens?"
            rows={3}
            className="mt-2 w-full rounded-lg border border-border p-2 text-base"
          />
          <p className="mt-1 text-xs text-muted">
            Hidden from everyone else until you resolve it yourself.
          </p>
          <button
            onClick={handleSubmit}
            className="mt-2 min-h-10 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast"
          >
            🔮 Lock in prediction
          </button>
        </div>
      ) : (
        <p className="rounded-lg bg-surface-alt p-3 text-xs text-muted">
          Set your current chapter to make a prediction.
        </p>
      )}

      <ul className="space-y-2">
        {(predictions as Prediction[] | undefined)?.map((p) => {
          const isMine = p.user_id === user?.id
          return (
            <li key={p.id} className="rounded-card bg-surface p-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="font-semibold text-text">
                  {isMine ? 'You' : (p.profiles?.display_name ?? 'Someone')}
                </span>
                {p.chapters && (
                  <span className="rounded-full bg-surface-alt px-2 py-0.5">
                    Ch. {p.chapters.position}
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                {p.body}
              </p>
              {p.verdict ? (
                <p className="mt-2 text-xs font-semibold">
                  {VERDICT_LABELS[p.verdict]}
                </p>
              ) : isMine ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['correct', 'incorrect', 'unclear'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() =>
                        resolvePrediction.mutate({ predictionId: p.id, verdict: v })
                      }
                      className="min-h-9 rounded-full border border-border px-2 py-1.5 text-xs font-medium"
                    >
                      {VERDICT_LABELS[v]}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this prediction?')) {
                        deletePrediction.mutate(p.id)
                      }
                    }}
                    className="min-h-9 rounded-md px-2 py-1.5 text-xs text-red-600"
                  >
                    Delete
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">🔮 Awaiting the result…</p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="rounded-card bg-surface p-3">
        <h2 className="text-sm font-semibold">Scoreboard</h2>
        {!fullAccess ? (
          <p className="mt-1 text-xs text-muted">
            Finish the book to see everyone's prediction scores.
          </p>
        ) : scoreboard && scoreboard.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {scoreboard.map((row) => (
              <li
                key={row.user_id}
                className="flex items-center justify-between rounded-lg bg-surface-alt px-3 py-2 text-sm"
              >
                <span>{row.user_id === user?.id ? 'You' : row.display_name}</span>
                <span className="text-muted">
                  ✅ {row.correct} · ❌ {row.incorrect} · 🤷 {row.unclear}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted">No resolved predictions yet.</p>
        )}
      </div>
    </div>
  )
}
