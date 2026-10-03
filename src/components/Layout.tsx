import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import AchievementWatcher from '@/components/AchievementWatcher'
import { getActiveTestAccount, switchToReal } from '@/lib/testAccounts'
import type { MyGroup } from '@/lib/group/useMyGroup'

// No bottom nav: Home is the only permanent destination now.
// Achievements is reachable via a strip on Home, and Add Book via the
// header icon here -- both are occasional actions, not daily-use ones,
// so neither earns permanent chrome the way a persistent nav tab would.
export default function Layout({ group }: { group: MyGroup }) {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  // Switching accounts always reloads the page (see testAccounts.ts), so
  // this never needs to update within a mounted session -- read once.
  const [testAccount] = useState(() => getActiveTestAccount())
  const [switching, setSwitching] = useState(false)

  async function handleBackToReal() {
    setSwitching(true)
    try {
      await switchToReal()
    } catch {
      setSwitching(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-[calc(2rem+env(safe-area-inset-bottom))]">
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
          {!isHome && (
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
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-lg"
            aria-label="Add book"
          >
            +
          </NavLink>
          <NavLink
            to="/settings"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-lg"
            aria-label="Settings"
          >
            ⚙️
          </NavLink>
        </div>
      </header>

      <main className="px-4 py-4">
        <Outlet />
      </main>
    </div>
  )
}
