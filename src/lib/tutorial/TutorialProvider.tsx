import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useGroupBooks } from '@/lib/books/queries'
import { useMarkTutorialSeen, useMyProfile } from '@/lib/profile/queries'
import type { MyGroup } from '@/lib/group/useMyGroup'
import { TUTORIAL_STEPS } from './steps'
import type { TutorialContext as TutorialCtxData, TutorialStep } from './types'

type TutorialState = {
  active: boolean
  step: TutorialStep | null
  stepNumber: number
  totalSteps: number
  isFirst: boolean
  ctx: TutorialCtxData
  targetRect: DOMRect | null
  start: () => void
  next: () => void
  back: () => void
  skip: () => void
  pickBook: (bookId: string) => void
}

const TutorialStateContext = createContext<TutorialState | null>(null)

export function useTutorial() {
  const ctx = useContext(TutorialStateContext)
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider')
  return ctx
}

const POLL_INTERVAL_MS = 100
const POLL_TIMEOUT_MS = 2000

// Walks forward/backward from `from`, skipping any step whose route can't
// be resolved (no book picked yet) or whose own shouldSkip says so. Returns
// an out-of-range index (< 0, or >= length) when there's nothing left in
// that direction -- next()/back() treat that as "finish" / "can't go back".
function resolveIndex(from: number, direction: 1 | -1, ctx: TutorialCtxData): number {
  let i = from
  while (i >= 0 && i < TUTORIAL_STEPS.length) {
    const step = TUTORIAL_STEPS[i]
    const routeOk = step.route ? step.route(ctx) !== null : true
    const skipped = step.shouldSkip?.(ctx) ?? false
    if (routeOk && !skipped) return i
    i += direction
  }
  return direction === 1 ? TUTORIAL_STEPS.length : -1
}

export function TutorialProvider({
  group,
  children,
}: {
  group: MyGroup
  children: ReactNode
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { data: profile } = useMyProfile()
  const markSeen = useMarkTutorialSeen()
  const { data: groupBooks } = useGroupBooks(group.id)

  const books = useMemo(
    () => (groupBooks ?? []).map((b) => ({ id: b.id, title: b.title, author: b.author })),
    [groupBooks],
  )

  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [pickedBookId, setPickedBookId] = useState<string | null>(null)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  // Snapshotted when the tour starts, so a book added for real during the
  // Add Book step can be detected (and used automatically) without the
  // tour-runner having to pick it again from the list.
  const initialBookIdsRef = useRef<Set<string> | null>(null)
  const autoOfferedRef = useRef(false)

  const justAddedBookId = useMemo(() => {
    if (!initialBookIdsRef.current) return null
    return books.find((b) => !initialBookIdsRef.current!.has(b.id))?.id ?? null
  }, [books])

  const ctx: TutorialCtxData = useMemo(
    () => ({ books, bookId: pickedBookId ?? justAddedBookId }),
    [books, pickedBookId, justAddedBookId],
  )

  function finish() {
    setActive(false)
    setTargetRect(null)
    if (!profile?.has_seen_tutorial) markSeen.mutate()
  }

  function start() {
    initialBookIdsRef.current = new Set(books.map((b) => b.id))
    setPickedBookId(null)
    setActive(true)
    setStepIndex(resolveIndex(0, 1, { books, bookId: null }))
  }

  // Auto-offer once per account, the first time we know profile.has_seen_tutorial is false.
  useEffect(() => {
    if (autoOfferedRef.current || !profile || profile.has_seen_tutorial) return
    autoOfferedRef.current = true
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  function next() {
    const nextIndex = resolveIndex(stepIndex + 1, 1, ctx)
    if (nextIndex >= TUTORIAL_STEPS.length) {
      finish()
      return
    }
    setStepIndex(nextIndex)
  }

  function back() {
    const prevIndex = resolveIndex(stepIndex - 1, -1, ctx)
    if (prevIndex < 0) return
    setStepIndex(prevIndex)
  }

  function skip() {
    finish()
  }

  // Resolves the next index against the just-picked book directly, rather
  // than the current render's `ctx` -- setPickedBookId hasn't re-rendered
  // yet at this point in the same event, so ctx.bookId here would still
  // read null and skip straight past every book-dependent step.
  function pickBook(bookId: string) {
    setPickedBookId(bookId)
    const nextCtx = { ...ctx, bookId }
    const nextIndex = resolveIndex(stepIndex + 1, 1, nextCtx)
    if (nextIndex >= TUTORIAL_STEPS.length) {
      finish()
      return
    }
    setStepIndex(nextIndex)
  }

  const step = active ? (TUTORIAL_STEPS[stepIndex] ?? null) : null

  // Drive navigation to the step's route, then keep measuring its target
  // element for as long as the step is shown -- not just once when first
  // found. A one-shot measurement would go stale the moment the target's
  // own size changes after `prepare()` expands something around it (the
  // composer growing once focused, "More options" opening), or on an
  // ordinary scroll/resize; polling continuously covers all three without
  // needing separate scroll/resize listeners.
  useEffect(() => {
    if (!active || !step) return
    const targetRoute = step.route ? step.route(ctx) : null
    if (targetRoute && location.pathname !== targetRoute) {
      navigate(targetRoute)
      return
    }

    step.prepare?.()

    if (step.kind !== 'spotlight' || !step.target) {
      setTargetRect(null)
      return
    }

    const selector = step.target
    const startedAt = Date.now()
    let warned = false
    setTargetRect(null)

    const intervalId = window.setInterval(() => {
      const el = document.querySelector(selector)
      if (el) {
        setTargetRect(el.getBoundingClientRect())
        return
      }
      // Missing on this tick alone isn't conclusive (a re-render from
      // prepare() can blink an element out and back in) -- only treat it as
      // "really gone" once it's been missing past the timeout, whether it
      // was never found at all or (e.g. the add-book step's search form
      // getting replaced by BookSetupStep once a book's actually added)
      // disappeared partway through. Either way that falls back to a
      // centered card instead of freezing the ring on stale content, and
      // keeps polling after that so it recovers if the target comes back.
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setTargetRect(null)
        if (!step.optionalTarget && !warned) {
          warned = true
          console.warn(`[tutorial] step "${step.id}" never found target "${selector}"`)
        }
      }
    }, POLL_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, location.pathname])

  // advanceOn: 'click-target' -- let the real element do its normal job
  // (e.g. the + icon's own navigation) and treat that tap as "Next" too.
  useEffect(() => {
    if (!active || !step || step.advanceOn !== 'click-target' || !step.target) return
    const el = document.querySelector(step.target)
    if (!el) return
    function handleClick() {
      next()
    }
    el.addEventListener('click', handleClick, { once: true })
    return () => el.removeEventListener('click', handleClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, targetRect])

  const value: TutorialState = {
    active,
    step,
    stepNumber: stepIndex + 1,
    totalSteps: TUTORIAL_STEPS.length,
    isFirst: stepIndex === 0,
    ctx,
    targetRect,
    start,
    next,
    back,
    skip,
    pickBook,
  }

  return (
    <TutorialStateContext.Provider value={value}>{children}</TutorialStateContext.Provider>
  )
}
