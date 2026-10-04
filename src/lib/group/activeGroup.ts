// Which of the signed-in person's (possibly several) groups the app is
// currently showing. Per-device, not synced to the account -- same
// reasoning as testAccounts.ts's active view: this is "which one am I
// looking at on this device right now," not a collaborative setting.
const ACTIVE_GROUP_KEY = 'nabc-active-group'

export function getActiveGroupId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_GROUP_KEY)
  } catch {
    return null
  }
}

// Every query in the app is cached by React Query in memory and keyed by
// group id in only some places, not all -- switching the active group
// without a hard reload would keep showing a mix of the old and new
// group's data until each query happened to refetch, same reasoning
// switchToTestAccount (testAccounts.ts) reloads instead of invalidating.
export function setActiveGroupId(groupId: string) {
  try {
    localStorage.setItem(ACTIVE_GROUP_KEY, groupId)
  } catch {
    // Won't persist across reloads this session -- useMyGroup() just falls
    // back to the oldest-joined group again, same as never having picked.
  }
  window.location.assign(import.meta.env.BASE_URL)
}
