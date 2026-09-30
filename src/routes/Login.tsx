import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'

// Supabase's own email sender is throttled hard (a handful of sends per
// hour) since it's meant for dev/low-volume use, not real traffic -- see
// SPEC.md. This cooldown is a guess at a safe retry window, not a value
// Supabase reports back; its purpose is just to stop someone from
// immediately re-hitting "Send" and digging the rate limit hole deeper.
const RATE_LIMIT_COOLDOWN_SECONDS = 60

function isRateLimitError(error: { status?: number; message: string }) {
  return error.status === 429 || /rate limit/i.test(error.message)
}

export default function Login() {
  const { authError } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const [cooldownSeconds, setCooldownSeconds] = useState(0)

  useEffect(() => {
    if (cooldownSeconds === 0) return
    const timer = setTimeout(() => setCooldownSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(timer)
  }, [cooldownSeconds])

  // A stale/expired/reused magic link redirects back here with an error in
  // the URL hash (AuthProvider reads it and clears the hash) rather than
  // ever reaching onAuthStateChange -- surface it instead of silently
  // dumping the user back on this same form with no explanation.
  useEffect(() => {
    if (authError) {
      setStatus('error')
      setErrorMessage(authError)
    }
  }, [authError])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (cooldownSeconds > 0) return
    setStatus('sending')
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Not window.location.href: that also carries whatever hash is
        // currently in the address bar (e.g. a stale #error=... from an
        // earlier failed attempt), which Supabase then appends the real
        // session tokens onto instead of replacing -- producing a URL with
        // two concatenated hash fragments that can't be parsed correctly.
        emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    })

    if (error) {
      setStatus('error')
      if (isRateLimitError(error)) {
        setErrorMessage(
          "You've requested a few links in a row — wait a bit before trying again.",
        )
        setCooldownSeconds(RATE_LIMIT_COOLDOWN_SECONDS)
      } else {
        setErrorMessage(error.message)
      }
      return
    }

    setStatus('sent')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-card bg-surface p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-accent">Not A Book Club</h1>
        <p className="mt-2 text-sm text-muted">
          Read at your own pace. Discuss without spoilers.
        </p>

        {status === 'sent' ? (
          <p className="mt-6 rounded-lg bg-surface-alt p-4 text-sm">
            Check <strong>{email}</strong> for a magic link to sign in.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={status === 'sending' || cooldownSeconds > 0}
              className="min-h-11 w-full rounded-lg bg-accent px-3 py-3 text-base font-semibold text-accent-contrast disabled:opacity-60"
            >
              {cooldownSeconds > 0
                ? `Try again in ${cooldownSeconds}s`
                : status === 'sending'
                  ? 'Sending link…'
                  : 'Send magic link'}
            </button>
            {status === 'error' && (
              <p className="text-sm text-red-600">{errorMessage}</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
