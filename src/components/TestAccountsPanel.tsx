import { useState } from 'react'
import {
  createTestAccount,
  deleteTestAccount,
  listTestAccounts,
  switchToTestAccount,
  type SavedTestAccount,
} from '@/lib/testAccounts'

// Admin-only -- and only reachable as yourself: switching "View as" drops
// your session's role to the test account's ('member'), which hides this
// whole panel, same as it would for any non-admin. Getting back to admin
// view goes through the persistent banner Layout shows on every page
// instead (see testAccounts.ts's switchToReal), not through here -- which
// is also why nothing in this panel has to handle "viewing as" one of its
// own listed accounts: you can't be looking at this panel while that's true.
//
// Creates throwaway, email-less members (real Supabase anonymous-auth
// accounts under the hood -- see the test-accounts edge function) for
// trying out things you can't see from your own account, like a
// hidden-until-revealed comment or someone else's chapter-unlock position.
// "View as" actually swaps the browser's auth session, so RLS genuinely
// sees you as that account rather than approximating it; a full page
// reload follows since most of the app's cached data isn't keyed by user
// id and would otherwise keep showing your own view.
export default function TestAccountsPanel() {
  const [accounts, setAccounts] = useState<SavedTestAccount[]>(() => listTestAccounts())
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setBusy(true)
    setError('')
    try {
      const account = await createTestAccount(label.trim() || `Test ${accounts.length + 1}`)
      setAccounts((prev) => [...prev, account])
      setLabel('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the test account.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(account: SavedTestAccount) {
    if (!window.confirm(`Delete "${account.label}"? This removes its account and comments for good.`)) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await deleteTestAccount(account.userId)
      setAccounts((prev) => prev.filter((a) => a.userId !== account.userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the test account.')
      setBusy(false)
    }
    // A successful delete of the currently-active account reloads the page
    // itself (see testAccounts.ts) -- nothing left to do here in that case.
  }

  async function handleViewAs(account: SavedTestAccount) {
    setBusy(true)
    setError('')
    try {
      await switchToTestAccount(account)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch accounts.')
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted">Test accounts</h2>
      <p className="mt-1 text-xs text-muted">
        Disposable members for testing things another account would see, like
        a hidden comment or someone else's reading position.
      </p>

      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={`Test ${accounts.length + 1}`}
          className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-base"
        />
        <button
          onClick={handleCreate}
          disabled={busy}
          className="min-h-11 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60"
        >
          + Create
        </button>
      </div>

      {accounts.length > 0 && (
        <ul className="mt-2 space-y-1">
          {accounts.map((account) => (
            <li
              key={account.userId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">{account.label}</span>
              <span className="flex items-center gap-2">
                <button
                  onClick={() => handleViewAs(account)}
                  disabled={busy}
                  className="min-h-9 rounded-full border border-accent px-3 py-1.5 text-xs text-accent disabled:opacity-60"
                >
                  View as
                </button>
                <button
                  onClick={() => handleDelete(account)}
                  disabled={busy}
                  className="min-h-9 rounded-full border border-border px-3 py-1.5 text-xs text-red-600 disabled:opacity-60"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
