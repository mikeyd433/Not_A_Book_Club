import confetti from 'canvas-confetti'

// Small celebration moments on unlock/achievement (per SPEC's Style
// section) -- a quick burst, not a full-screen takeover. Respects
// prefers-reduced-motion rather than forcing it on everyone.
export function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.7 },
  })
}
