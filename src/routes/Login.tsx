import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle',
  )
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.href,
      },
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error.message)
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
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60"
            >
              {status === 'sending' ? 'Sending link…' : 'Send magic link'}
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
