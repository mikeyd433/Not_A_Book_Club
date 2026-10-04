import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTutorial } from '@/lib/tutorial/TutorialProvider'

// Rendered inside TutorialProvider (not Layout's own body) specifically so
// it can read `active` and stay out of the tour's way: TutorialProvider
// drives its own scroll position for each spotlight step (scrollIntoView,
// in TutorialProvider.tsx), and resetting to the top here too on that same
// navigation would just flash the page to the top for a beat before the
// tour's own scroll corrected it a tick later -- effects on a child
// (TutorialProvider) fire before a parent's (Layout), so the tour's own
// handling can't simply run first and win.
export default function ScrollToTop() {
  const { pathname } = useLocation()
  const { active } = useTutorial()

  useEffect(() => {
    if (active) return
    window.scrollTo(0, 0)
  }, [pathname, active])

  return null
}
