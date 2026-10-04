// An invite link (?invite=CODE) only survives as long as the page it
// landed on. A brand-new visitor has to leave for their email client and
// tap a magic link to finish signing in, which redirects back to a bare
// URL -- Login's emailRedirectTo deliberately strips query params (see
// Login.tsx, to avoid carrying a stale #error=... hash along with it) --
// so by the time they're authenticated and JoinOrCreateGroup can read it,
// the code is already gone.
//
// Stashing it in localStorage the moment it's seen -- the same
// run-as-an-import-side-effect pattern as theme.ts/pwaInstall.ts, loaded
// once from main.tsx before anything else renders -- means it's still
// there once they're back.
const STORAGE_KEY = 'nabc-pending-invite'

const params = new URLSearchParams(window.location.search)
const inviteFromUrl = params.get('invite')
if (inviteFromUrl) {
  window.localStorage.setItem(STORAGE_KEY, inviteFromUrl.toUpperCase())
}

// One-shot: clears it on read, so a stale code doesn't linger forever for
// someone who never used it, or resurface for a later, unrelated group.
export function consumePendingInvite(): string | null {
  const code = window.localStorage.getItem(STORAGE_KEY)
  if (code) window.localStorage.removeItem(STORAGE_KEY)
  return code
}
