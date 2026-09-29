import { NavLink, Outlet } from 'react-router-dom'
import AchievementWatcher from '@/components/AchievementWatcher'
import type { MyGroup } from '@/lib/group/useMyGroup'

// No bottom nav: Home is the only permanent destination now.
// Achievements is reachable via a strip on Home, and Add Book via the
// header icon here -- both are occasional actions, not daily-use ones,
// so neither earns permanent chrome the way a persistent nav tab would.
export default function Layout({ group }: { group: MyGroup }) {
  return (
    <div className="min-h-screen bg-bg pb-6">
      <AchievementWatcher />
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted">
            {group.name}
          </p>
          <p className="text-lg font-bold text-accent">Not A Book Club</p>
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
