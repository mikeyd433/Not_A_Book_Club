import { Component, type ReactNode } from 'react'

// Wraps the whole app (see main.tsx) so one uncaught render error -- a null
// a comment's deleted parent chapter still references, say -- shows a
// recoverable screen instead of a blank white page with nothing in the UI
// to explain it.
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
          <p className="text-base font-semibold text-text">Something went wrong.</p>
          <p className="max-w-sm text-sm text-muted">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 min-h-11 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast"
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
