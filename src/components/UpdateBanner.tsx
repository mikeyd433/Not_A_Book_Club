import { useRegisterSW } from 'virtual:pwa-register/react'

// registerType: 'prompt' (vite.config.ts) means a new service worker sits
// waiting rather than taking over silently -- this is what actually shows
// that to someone and lets them apply it. An open tab/installed PWA has no
// other reason to re-check for one on its own, so this also polls the
// registration every hour; the browser only checks automatically on a
// fresh navigation, which a long-lived session might not hit for days.
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Defaults to registering on the window `load` event, which races
    // against this component actually mounting -- confirmed live (headless
    // browser check): registration never fired at all when `load` beat the
    // effect that attaches it, which for an already-cached PWA reload (the
    // exact case this feature exists for) is a real possibility, not an
    // edge case.
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="flex items-center justify-between gap-2 bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast">
      <span>🔄 An update is ready</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setNeedRefresh(false)}
          className="min-h-7 rounded-full px-2 py-1"
        >
          Dismiss
        </button>
        <button
          onClick={() => updateServiceWorker(true)}
          className="min-h-7 rounded-full border border-accent-contrast/40 px-2 py-1"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
