import { useSyncExternalStore } from 'react'
import { CHANGELOG_ENTRIES } from './entries'

// Per-device, not synced to the account -- same reasoning as theme.ts:
// this is just "have I looked at the changelog since it last changed,"
// not a collaborative setting.
const STORAGE_KEY = 'nabc-changelog-last-seen'

function getStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

let lastSeenId: string | null = getStored()
const listeners = new Set<() => void>()

export function markChangelogSeen() {
  const latestId = CHANGELOG_ENTRIES[0]?.id
  if (!latestId || lastSeenId === latestId) return
  lastSeenId = latestId
  try {
    localStorage.setItem(STORAGE_KEY, latestId)
  } catch {
    // Won't persist across reloads this session -- the dot just comes back.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getHasUnseen(): boolean {
  const latestId = CHANGELOG_ENTRIES[0]?.id
  return Boolean(latestId) && lastSeenId !== latestId
}

export function useHasUnseenChangelog(): boolean {
  return useSyncExternalStore(subscribe, getHasUnseen)
}
