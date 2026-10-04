/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

const THEME_COLOR = '#7c3aed'

// Served from a sub-path of dabingabongo.com (fetched + built into dist/nabc
// by that site's build.sh, the same way it vendors The Delve). Assets, the
// router basename, and the PWA manifest scope all key off this single value.
const BASE = '/nabc/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // Registration happens through the useRegisterSW() hook in
      // UpdateBanner.tsx instead (needs the needRefresh/updateServiceWorker
      // state to show a prompt) -- the default auto-injected <script> tag
      // would register a second, redundant service-worker client alongside
      // it.
      injectRegister: false,
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Pulled into the generated sw.js verbatim (same scope, same file
        // set) so push/notificationclick handling doesn't require
        // switching to injectManifest and hand-rewriting the precaching
        // config above. See public/push-sw.js.
        importScripts: ['push-sw.js'],
        navigateFallback: `${BASE}index.html`,
        // Never hijack the SW script itself, Supabase auth/api round-trips, or
        // Supabase Storage (cover uploads).
        navigateFallbackDenylist: [/sw\.js$/, /\/auth\//, /\/rest\//, /\/storage\//],
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'nabc-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Open Library covers, fetched cross-origin.
            urlPattern: ({ url }) => url.hostname === 'covers.openlibrary.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'openlibrary-covers',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Not A Book Club',
        short_name: 'NABC',
        description:
          'Asynchronous, chapter-locked book club discussion for a private friend group.',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        background_color: '#ffffff',
        theme_color: THEME_COLOR,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
