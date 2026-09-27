import { useEffect, useRef } from 'react'

type WheelItem = { id: string; label: string }

const ITEM_HEIGHT = 44
const VISIBLE_COUNT = 5
const PADDING = ITEM_HEIGHT * Math.floor(VISIBLE_COUNT / 2)

// A drum-style picker like the iOS time picker: scroll-snap does the heavy
// lifting natively, we just read back which item settled in the center.
export default function ChapterWheelPicker({
  items,
  value,
  onChange,
}: {
  items: WheelItem[]
  value: string | null
  onChange: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>()

  const selectedIndex = Math.max(0, items.findIndex((i) => i.id === value))

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = selectedIndex * ITEM_HEIGHT
    // Only re-sync from external value changes, not our own scroll-driven ones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current)
    scrollTimeout.current = setTimeout(() => {
      const index = Math.round(el.scrollTop / ITEM_HEIGHT)
      const clamped = Math.min(items.length - 1, Math.max(0, index))
      el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' })
      const item = items[clamped]
      if (item && item.id !== value) onChange(item.id)
    }, 120)
  }

  return (
    <div
      className="relative select-none"
      style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 rounded-lg border-y-2 border-accent bg-accent/5"
        style={{ height: ITEM_HEIGHT }}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll [scrollbar-width:none]"
        style={{ paddingBlock: PADDING, WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="flex snap-center items-center justify-center text-center"
            style={{ height: ITEM_HEIGHT }}
          >
            <span
              className={
                item.id === value
                  ? 'text-base font-bold text-accent'
                  : 'text-sm text-muted'
              }
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
