import { useEffect, useRef } from 'react'
import { useAchievementsFeed } from '@/lib/achievements/queries'
import { useAuth } from '@/lib/auth/AuthProvider'
import { celebrate } from '@/lib/celebrate'

// Mounted once in Layout.tsx so a new achievement gets celebrated no
// matter which screen you're on when it lands, not just the Achievements
// page. Diffs against the previous fetch's keys rather than a fixed list,
// so it works for every achievement without needing to know about each
// one individually.
export default function AchievementWatcher() {
  const { user } = useAuth()
  const { data: feed } = useAchievementsFeed()
  const seenKeys = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!feed || !user) return

    const myKeys = new Set(
      feed.filter((f) => f.user_id === user.id).map((f) => f.achievement_key),
    )

    if (seenKeys.current === null) {
      // First load this session -- record the baseline, don't celebrate
      // achievements earned before now.
      seenKeys.current = myKeys
      return
    }

    const hasNew = [...myKeys].some((k) => !seenKeys.current!.has(k))
    if (hasNew) celebrate()
    seenKeys.current = myKeys
  }, [feed, user])

  return null
}
