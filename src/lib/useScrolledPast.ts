import { useEffect, useState } from 'react'

// How far the page has to scroll before Thread's condensed cover/title bar
// takes over from BookLayout's own header -- shared with BookLayout's
// under-the-bell chapter picker (which shows exactly until this point) so
// the two stay in sync without either needing to import the other's route
// module.
export const CONDENSED_BAR_SHOW_AFTER = 120

// Shared by Thread's condensed bar and BookLayout's under-the-bell chapter
// picker so the two stay in sync on the same threshold without either
// having to know about the other -- one hides exactly when the other shows.
export function useScrolledPast(threshold: number): boolean {
  const [scrolled, setScrolled] = useState(() => window.scrollY > threshold)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > threshold)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return scrolled
}
