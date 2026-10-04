import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import AchievementWatcher from '@/components/AchievementWatcher'
import Spotlight from '@/components/tutorial/Spotlight'
import { TutorialProvider } from '@/lib/tutorial/TutorialProvider'
import { getActiveTestAccount, switchToReal } from '@/lib/testAccounts'
import { useHasUnseenChangelog } from '@/lib/changelog/seen'
import type { MyGroup } from '@/lib/group/useMyGroup'

// Bottom nav covers the two permanent daily-use destinations: My Shelf
// (Home) and the Bulletin Board. Achievements is reachable via a strip on
// Home, and Add Book via the header icon here -- both are occasional
// actions, not daily-use ones, so neither earns a tab of its own.
const ROOT_PATHS = ['/', '/bulletin']

export default function Layout({ group }: { group: MyGroup }) {
  const { pathname } = useLocation()
  const isRoot = ROOT_PATHS.includes(pathname)
  // Switching accounts always reloads the page (see testAccounts.ts), so
  // this never needs to update within a mounted session -- read once.
  const [testAccount] = useState(() => getActiveTestAccount())
  const [switching, setSwitching] = useState(false)
  const hasUnseenChangelog = useHasUnseenChangelog()

  async function handleBackToReal() {
    setSwitching(true)
    try {
      await switchToReal()
    } catch {
      setSwitching(false)
    }
  }

  return (
    <TutorialProvider group={group}>
      <div
        className={
          isRoot
            ? 'min-h-screen bg-bg pb-[calc(4.5rem+env(safe-area-inset-bottom))]'
            : 'min-h-screen bg-bg pb-[calc(2rem+env(safe-area-inset-bottom))]'
        }
      >
        <AchievementWatcher />
        {testAccount && (
          <div className="flex items-center justify-between gap-2 bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast">
            <span>🧪 Viewing as {testAccount.label}</span>
            <button
              onClick={handleBackToReal}
              disabled={switching}
              className="min-h-7 rounded-full border border-accent-contrast/40 px-2 py-1 disabled:opacity-60"
            >
              {switching ? 'Switching…' : '← Back to my account'}
            </button>
          </div>
        )}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-2">
            {!isRoot && (
              <NavLink
                to="/"
                className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-full border border-border text-lg"
                aria-label="Back to home"
              >
                ←
              </NavLink>
            )}
            <div className="min-w-0">
              <p className="truncate text-xs uppercase tracking-wide text-muted">
                {group.name}
              </p>
              <p className="text-lg font-bold text-accent">Not A Book Club</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <NavLink
              to="/add-book"
              data-tour="add-book-button"
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-lg"
              aria-label="Add book"
            >
              +
            </NavLink>
            <NavLink
              to="/settings"
              className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-lg"
              aria-label="Settings"
            >
              ⚙️
              {hasUnseenChangelog && (
                <span className="absolute right-1 top-1 size-2.5 rounded-full bg-accent ring-2 ring-surface" />
              )}
            </NavLink>
          </div>
        </header>

        <main className="px-4 py-4">
          <Outlet />
        </main>

        {isRoot && (
          <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <span className="text-lg">📚</span>
              My Shelf
            </NavLink>
            <NavLink
              to="/bulletin"
              data-tour="bulletin-tab"
              className={({ isActive }) =>
                `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <span className="text-lg">📌</span>
              Bulletin Board
            </NavLink>
          </nav>
        )}
      </div>
      <Spotlight />
    </TutorialProvider>
  )
}
