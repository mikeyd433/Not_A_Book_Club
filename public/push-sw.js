// Push notification handling, pulled into the Workbox-generated service
// worker via workbox.importScripts (see vite.config.ts) rather than
// switching to injectManifest -- this file runs in the same global scope
// as the generated sw.js, so `self` here is the same service worker, but
// the existing precaching/runtime-caching config is untouched.
const BASE = '/nabc'

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Not A Book Club', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Not A Book Club'
  const options = {
    body: data.body || '',
    icon: `${BASE}/pwa-192x192.png`,
    badge: `${BASE}/pwa-192x192.png`,
    data: { url: BASE + (data.url || '/') },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || `${BASE}/`

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    }),
  )
})
