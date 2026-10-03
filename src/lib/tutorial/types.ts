export type TutorialBook = { id: string; title: string; author: string | null }

// What a step's route/title/body/shouldSkip functions get to read. bookId is
// whichever book the live steps (Overview/Chapters/Discussion onward) run
// against -- either one the tour-runner just added for real, or one they
// picked from the group's existing shelf via the 'picker' step.
export type TutorialContext = {
  books: TutorialBook[]
  bookId: string | null
}

export type TutorialStep = {
  id: string
  // 'spotlight' highlights a real element (`target`, a CSS selector).
  // 'modal' is a plain centered card (welcome/done). 'picker' is a centered
  // card that also renders the group's book list, for picking which book
  // the live steps continue with.
  kind: 'spotlight' | 'modal' | 'picker'
  // Returns the route this step needs to be on, or null if it can't be
  // resolved right now (e.g. no book picked yet) -- a null route skips the
  // step entirely, same as an explicit shouldSkip. Omit for a step that
  // doesn't care what page it's on (modal/picker steps).
  route?: (ctx: TutorialContext) => string | null
  target?: string
  // Some targets (the prediction checkbox, the spoiler controls) only exist
  // once Composer is focused/expanded -- this runs once, right before
  // polling for the target, to get them into the DOM.
  prepare?: () => void
  // If the target never mounts (the live example it demonstrates doesn't
  // currently exist for the picked book -- no locked chapter, no hidden
  // comments, etc.), fall back to a centered descriptive card instead of
  // failing silently. Every step whose target depends on the picked book's
  // current state needs this; static chrome (tab bar, invite code, the add
  // book button) doesn't.
  optionalTarget?: boolean
  // 'click-target' advances when the user taps the real highlighted
  // element itself rather than a Next button -- used once, for the + Add
  // Book icon, so the tour doesn't fight with the real navigation that tap
  // already causes.
  advanceOn?: 'next' | 'click-target'
  shouldSkip?: (ctx: TutorialContext) => boolean
  title: string | ((ctx: TutorialContext) => string)
  body: string | ((ctx: TutorialContext) => string)
}
