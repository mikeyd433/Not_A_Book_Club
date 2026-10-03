// Multiple Composer instances can exist on Discussion at once (one per
// unlocked chapter) -- this grabs whichever renders first in DOM order,
// which is good enough for demonstrating a mechanic during the tour.
export function focusFirstComposerTextarea() {
  const el = document.querySelector<HTMLTextAreaElement>('[data-tour="composer-textarea"]')
  el?.focus()
}

// BookDetail's spoil_me/is_rereading controls live behind a collapsed
// "More options" toggle -- idempotent via aria-expanded, so revisiting this
// step (e.g. tapping Back then Next again) doesn't re-collapse it.
export function expandMoreOptions() {
  const toggle = document.querySelector<HTMLButtonElement>('[data-tour="more-options-toggle"]')
  if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click()
}
