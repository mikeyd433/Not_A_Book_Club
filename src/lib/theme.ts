import { useSyncExternalStore } from 'react'

// Imported for its side effect in main.tsx (not lazily from Settings) so
// the stored preference is applied before the app renders, the same
// reasoning as pwaInstall.ts's early beforeinstallprompt listener.
export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'nabc-theme'

function getStored(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark' || value === 'system') return value
  } catch {
    // Private browsing / storage disabled -- just fall back to system.
  }
  return 'system'
}

function applyTheme(pref: ThemePreference) {
  const root = document.documentElement
  if (pref === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', pref)
  }
}

let current: ThemePreference = getStored()
applyTheme(current)

const listeners = new Set<() => void>()

export function setTheme(pref: ThemePreference) {
  current = pref
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // Theme just won't persist across reloads this session.
  }
  applyTheme(pref)
  listeners.forEach((listener) => listener())
}

export function getTheme(): ThemePreference {
  return current
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useTheme(): ThemePreference {
  return useSyncExternalStore(subscribe, getTheme)
}
