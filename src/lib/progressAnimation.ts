import { useSyncExternalStore } from 'react'

// Whether progress bars show the moving diagonal-stripe ("barbershop
// pole") animation. Per-device, same storage pattern as theme.ts -- a
// pure display preference, not account data, so it doesn't need a
// shelf_entries/group_members round trip. Defaults on.
const STORAGE_KEY = 'nabc-progress-bar-animation'

function getStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

let current: boolean = getStored()
const listeners = new Set<() => void>()

export function setProgressBarAnimation(enabled: boolean) {
  current = enabled
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Preference just won't persist across reloads this session.
  }
  listeners.forEach((listener) => listener())
}

export function getProgressBarAnimation(): boolean {
  return current
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useProgressBarAnimation(): boolean {
  return useSyncExternalStore(subscribe, getProgressBarAnimation)
}
