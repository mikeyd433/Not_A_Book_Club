import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAchievementsCatalog, useAchievementsFeed } from '@/lib/achievements/queries'
import { useAuth } from '@/lib/auth/AuthProvider'

export default function Achievements() {
  const { user } = useAuth()
  const { data: catalog } = useAchievementsCatalog()
  const { data: feed } = useAchievementsFeed()

  const myEarnedKeys = useMemo(
    () => new Set((feed ?? []).filter((f) => f.user_id === user?.id).map((f) => f.achievement_key)),
    [feed, user?.id],
  )

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">🏆 Achievements</h1>

      <div>
        <h2 className="text-sm font-semibold text-muted">Your achievements</h2>
        <ul className="mt-2 space-y-2">
          {catalog?.map((a) => {
            const earned = myEarnedKeys.has(a.key)
            const showMystery = a.hidden && !earned
            return (
              <li
                key={a.key}
                className={`rounded-card p-3 ${earned ? 'bg-surface' : 'bg-surface-alt'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${earned ? '' : 'text-muted'}`}>
                    {earned ? '🏆' : '🔒'} {showMystery ? '???' : a.name}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {showMystery ? 'A hidden achievement — keep going.' : a.description}
                </p>
              </li>
            )
          })}
        </ul>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted">Recently earned</h2>
        <ul className="mt-2 space-y-2">
          {feed?.map((f) => (
            <li key={f.id} className="rounded-card bg-surface p-3">
              <p className="text-sm">
                {f.user_id === user?.id ? (
                  <span className="font-semibold">You</span>
                ) : (
                  <Link to={`/member/${f.user_id}`} className="font-semibold">
                    {f.display_name}
                  </Link>
                )}{' '}
                earned <span className="font-semibold">🏆 {f.name}</span>
                {f.book_title && <span className="text-muted"> — {f.book_title}</span>}
              </p>
              <p className="mt-0.5 text-xs text-muted">{f.description}</p>
            </li>
          ))}
          {feed?.length === 0 && (
            <p className="rounded-lg bg-surface-alt p-3 text-xs text-muted">
              No achievements earned yet — get reading!
            </p>
          )}
        </ul>
      </div>
    </div>
  )
}
