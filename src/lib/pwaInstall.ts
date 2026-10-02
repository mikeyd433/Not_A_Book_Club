import { useSyncExternalStore } from 'react'

// Chrome/Edge/Android fire `beforeinstallprompt` once per page load when
// install criteria are met, and only if a listener was already attached
// when it fires -- so this module is imported for its side effect in
// main.tsx (not lazily from Settings), to attach the listener as early as
// possible rather than only once someone happens to visit Settings.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari has no display-mode media query support; it exposes this
    // nonstandard property on navigator instead.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = isStandalone()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e as BeforeInstallPromptEvent
  notify()
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  installed = true
  notify()
})

export type InstallSnapshot = {
  canPrompt: boolean
  installed: boolean
}

let snapshot: InstallSnapshot = { canPrompt: false, installed }

export function getInstallSnapshot(): InstallSnapshot {
  const next = { canPrompt: deferredPrompt !== null, installed }
  // useSyncExternalStore requires a stable reference when nothing changed.
  if (next.canPrompt !== snapshot.canPrompt || next.installed !== snapshot.installed) {
    snapshot = next
  }
  return snapshot
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  notify()
  return outcome
}

export function useInstallPrompt(): InstallSnapshot {
  return useSyncExternalStore(subscribeInstall, getInstallSnapshot)
}
