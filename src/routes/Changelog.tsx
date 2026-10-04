import { useEffect } from 'react'
import { CHANGELOG_ENTRIES } from '@/lib/changelog/entries'
import { markChangelogSeen } from '@/lib/changelog/seen'

export default function Changelog() {
  // Opening this page is what clears the "new update" dot -- same spirit
  // as Thread marking comments_seen_at, just local to this device.
  useEffect(() => {
    markChangelogSeen()
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">🆕 What's new</h1>
        <p className="text-sm text-muted">Updates to Not A Book Club, newest first.</p>
      </div>

      <ul className="space-y-3">
        {CHANGELOG_ENTRIES.map((entry) => (
          <li key={entry.id} className="rounded-card bg-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <p className="mt-1 text-sm font-semibold">{entry.title}</p>
            <p className="mt-1 text-sm text-muted">{entry.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
