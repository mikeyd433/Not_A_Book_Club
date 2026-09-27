import { NavLink, Outlet } from 'react-router-dom'
import type { MyGroup } from '@/lib/group/useMyGroup'

export default function Layout({ group }: { group: MyGroup }) {
  return (
    <div className="min-h-screen bg-bg pb-20">
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            {group.name}
          </p>
          <p className="text-lg font-bold text-accent">Not A Book Club</p>
        </div>
        <NavLink
          to="/settings"
          className="rounded-full border border-border px-3 py-1 text-sm"
        >
          ⚙️
        </NavLink>
      </header>

      <main className="px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface">
        <NavTab to="/" label="Home" />
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
        `flex-1 py-3 text-center text-sm font-medium ${
          isActive ? 'text-accent' : 'text-muted'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
