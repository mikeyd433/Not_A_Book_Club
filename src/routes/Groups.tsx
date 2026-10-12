import { Link } from 'react-router-dom'
import { useMyGroup, useMyGroups } from '@/lib/group/useMyGroup'
import { setActiveGroupId } from '@/lib/group/activeGroup'

// Its own page rather than buried in Settings -- switching groups is
// something people reach for on the fly (the header's group name links
// here), not just a one-time setup step.
export default function Groups() {
  const { data: myGroups } = useMyGroups()
  const { data: activeGroup } = useMyGroup()

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">Your groups</h1>

      {!myGroups ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {myGroups.map((g) => {
            const isActive = g.id === activeGroup?.id
            return (
              <li key={g.id}>
                <button
                  onClick={() => !isActive && setActiveGroupId(g.id)}
                  disabled={isActive}
                  className="flex min-h-14 w-full items-center justify-between rounded-card bg-surface px-4 py-3 text-left active:bg-surface-alt disabled:active:bg-surface"
                >
                  <span className="min-w-0">
                    <span
                      className={`block truncate text-sm font-semibold ${isActive ? 'text-accent' : ''}`}
                    >
                      {g.name}
                    </span>
                    <span className="block text-xs text-muted">
                      {g.role === 'admin' ? 'Admin' : 'Member'}
                    </span>
                  </span>
                  {isActive && (
                    <span className="flex-shrink-0 text-xs font-semibold text-accent">
                      Current ✓
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <Link
        to="/join-group"
        className="flex min-h-11 w-full items-center justify-center rounded-card border border-dashed border-border px-3 py-2 text-sm font-semibold text-accent active:bg-surface-alt"
      >
        + Join or create another group
      </Link>
    </div>
  )
}
