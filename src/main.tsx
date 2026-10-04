import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import ErrorBoundary from '@/components/ErrorBoundary'
import UpdateBanner from '@/components/UpdateBanner'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import './index.css'
// Applies the stored theme preference before the app renders, rather
// than only once someone happens to visit Settings -- see theme.ts.
import '@/lib/theme'
// Attaches the beforeinstallprompt listener immediately, not just once
// someone happens to visit Settings -- see pwaInstall.ts for why.
import '@/lib/pwaInstall'
// Captures ?invite=CODE from the URL before anything else runs -- see
// pendingInvite.ts for why this has to happen this early.
import '@/lib/pendingInvite'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Outside Layout/App on purpose -- Layout only renders once someone
          is signed in and in a group, but the service worker (and the
          "update available" prompt it drives) needs to register
          regardless, same as the plain <script> tag this replaced did. */}
      <UpdateBanner />
      <BrowserRouter basename="/nabc">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
