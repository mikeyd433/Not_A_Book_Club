import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from '@/lib/auth/AuthProvider'
import './index.css'
// Applies the stored theme preference before the app renders, rather
// than only once someone happens to visit Settings -- see theme.ts.
import '@/lib/theme'
// Attaches the beforeinstallprompt listener immediately, not just once
// someone happens to visit Settings -- see pwaInstall.ts for why.
import '@/lib/pwaInstall'

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
    <BrowserRouter basename="/nabc">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
