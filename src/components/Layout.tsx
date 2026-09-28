import { NavLink, Outlet } from 'react-router-dom'
import AchievementWatcher from '@/components/AchievementWatcher'
import type { MyGroup } from '@/lib/group/useMyGroup'

export default function Layout({ group }: { group: MyGroup }) {
  return (
    <div className="min-h-screen bg-bg pb-24">
      <AchievementWatcher />
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted">
            {group.name}
          </p>
          <p className="text-lg font-bold text-accent">Not A Book Club</p>
        </div>
        <NavLink
          to="/settings"
          className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-full border border-border text-lg"
        >
          ⚙️
        </NavLink>
      </header>

      <main className="px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
        <NavTab to="/" label="Home" />
        <NavTab to="/achievements" label="🏆 Achievements" />
        <NavTab to="/add-book" label="Add Book" />
      </nav>
    </div>
  )
}

function NavTab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `min-h-12 flex-1 py-3 text-center text-sm font-medium ${
          isActive ? 'text-accent' : 'text-muted'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
