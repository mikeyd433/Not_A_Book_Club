import type { ReactNode } from 'react'
import { useTutorial } from '@/lib/tutorial/TutorialProvider'
import type { TutorialBook } from '@/lib/tutorial/types'

const CARD_WIDTH = 300
const EDGE_GAP = 16

export default function Spotlight() {
  const tutorial = useTutorial()
  const { active, step, targetRect, stepNumber, totalSteps, ctx, isFirst, next, back, skip, pickBook } =
    tutorial

  if (!active || !step) return null

  const showSpotlight = step.kind === 'spotlight' && targetRect !== null
  const title = typeof step.title === 'function' ? step.title(ctx) : step.title
  const body = typeof step.body === 'function' ? step.body(ctx) : step.body

  return (
    <div className="fixed inset-0 z-50" data-tutorial-overlay>
      {showSpotlight && targetRect ? (
        <SpotlightCutout rect={targetRect} />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      <TutorialCard rect={showSpotlight ? targetRect : null}>
        <p className="text-xs font-medium text-muted">
          Step {stepNumber} of {totalSteps}
        </p>
        <p className="mt-1 text-sm font-bold">{title}</p>
        <p className="mt-1 text-sm text-muted">{body}</p>

        {step.kind === 'picker' && (
          <BookPickerList books={ctx.books} onPick={pickBook} />
        )}

        <div className="mt-3 flex items-center justify-between gap-2">
          {step.id === 'welcome' ? (
            <>
              <button onClick={skip} className="min-h-9 px-2 text-sm text-muted">
                Skip
              </button>
              <button
                onClick={next}
                className="min-h-9 rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-contrast"
              >
                Start tour
              </button>
            </>
          ) : step.id === 'done' ? (
            <button
              onClick={next}
              className="min-h-9 w-full rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-contrast"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={back}
                disabled={isFirst}
                className="min-h-9 px-2 text-sm text-muted disabled:opacity-0"
              >
                Back
              </button>
              <div className="flex items-center gap-3">
                <button onClick={skip} className="min-h-9 px-2 text-sm text-muted">
                  Skip
                </button>
                {step.kind !== 'picker' && (
                  <button
                    onClick={next}
                    className="min-h-9 rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-contrast"
                  >
                    Next
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </TutorialCard>
    </div>
  )
}

// Four dark bands around the target's rect, leaving it (and only it)
// clickable -- simpler and more broadly compatible than a CSS mask/clip-path
// cutout, and needs no pointer-events trickery: the bands naturally block
// clicks, and the untouched gap naturally doesn't.
function SpotlightCutout({ rect }: { rect: DOMRect }) {
  const pad = 6
  const top = Math.max(0, rect.top - pad)
  const left = Math.max(0, rect.left - pad)
  const right = rect.right + pad
  const bottom = rect.bottom + pad

  return (
    <>
      <div className="fixed inset-x-0 top-0 bg-black/60" style={{ height: top }} />
      <div className="fixed inset-x-0 bottom-0 bg-black/60" style={{ top: bottom }} />
      <div className="fixed bg-black/60" style={{ top, left: 0, width: left, height: bottom - top }} />
      <div
        className="fixed bg-black/60"
        style={{ top, left: right, right: 0, height: bottom - top }}
      />
      <div
        className="pointer-events-none fixed rounded-lg ring-2 ring-accent"
        style={{ top, left, width: right - left, height: bottom - top }}
      />
    </>
  )
}

function TutorialCard({ rect, children }: { rect: DOMRect | null; children: ReactNode }) {
  if (!rect) {
    return (
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-card bg-surface p-4 shadow-lg">{children}</div>
      </div>
    )
  }

  const viewportW = window.innerWidth
  const viewportH = window.innerHeight
  const placeBelow = viewportH - rect.bottom > 220 || rect.top < 220
  const left = Math.min(Math.max(rect.left, EDGE_GAP), viewportW - EDGE_GAP - CARD_WIDTH)

  return (
    <div
      className="fixed rounded-card bg-surface p-4 shadow-lg"
      style={{
        width: Math.min(CARD_WIDTH, viewportW - EDGE_GAP * 2),
        left,
        ...(placeBelow ? { top: rect.bottom + 12 } : { bottom: viewportH - rect.top + 12 }),
      }}
    >
      {children}
    </div>
  )
}

function BookPickerList({
  books,
  onPick,
}: {
  books: TutorialBook[]
  onPick: (bookId: string) => void
}) {
  return (
    <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
      {books.map((book) => (
        <li key={book.id}>
          <button
            onClick={() => onPick(book.id)}
            className="flex w-full flex-col rounded-lg bg-surface-alt px-3 py-2 text-left"
          >
            <span className="truncate text-sm font-semibold">{book.title}</span>
            {book.author && <span className="truncate text-xs text-muted">{book.author}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}
