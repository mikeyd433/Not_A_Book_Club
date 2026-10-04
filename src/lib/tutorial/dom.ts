// Multiple Composer instances can exist on Discussion at once (one per
// unlocked chapter) -- this grabs whichever renders first in DOM order,
// which is good enough for demonstrating a mechanic during the tour.
export function focusFirstComposerTextarea() {
  const el = document.querySelector<HTMLTextAreaElement>('[data-tour="composer-textarea"]')
  el?.focus()
}
