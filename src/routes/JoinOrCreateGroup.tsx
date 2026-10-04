import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { consumePendingInvite } from '@/lib/pendingInvite'
import { setActiveGroupId } from '@/lib/group/activeGroup'
import { useMyGroups } from '@/lib/group/useMyGroup'
import { supabase } from '@/lib/supabase'

// Reached after login when the signed-in user isn't in a group yet (no
// header/back option then -- there's nothing to go back to) -- or from
// Settings' "Join or create another group" link once they're already in
// one (a "← Cancel" shows instead, since useMyGroups() finds existing
// groups). If they arrived via an invite link (?invite=CODE) the code is
// pre-filled -- from the URL if they were already logged in, or from
// pendingInvite.ts's localStorage stash if reaching this page required a
// magic-link round trip that dropped the query param along the way.
export default function JoinOrCreateGroup() {
  const [searchParams] = useSearchParams()
  const { data: existingGroups } = useMyGroups()
  const [inviteCode, setInviteCode] = useState(() =>
    (searchParams.get('invite') ?? consumePendingInvite() ?? '').toUpperCase(),
  )
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { data, error: rpcError } = await supabase.rpc('join_group_by_code', {
      p_invite_code: inviteCode.trim(),
    })

    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }

    // Lands them in the group they just joined, whether it's their first
    // or fifth -- same hard-reload reasoning as any other active-group
    // switch (activeGroup.ts).
    setActiveGroupId(data.id)
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { data, error: rpcError } = await supabase.rpc('create_group', {
      p_name: groupName.trim(),
    })

    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setActiveGroupId(data.id)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-8 rounded-card bg-surface p-8 shadow-sm">
        {existingGroups && existingGroups.length > 0 && (
          <Link to="/" className="text-sm font-semibold text-accent">
            ← Cancel
          </Link>
        )}
        <div>
          <h1 className="text-xl font-bold">Join your group</h1>
          <form onSubmit={handleJoin} className="mt-3 space-y-3">
            <input
              type="text"
              required
              placeholder="Invite code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-base uppercase outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-lg bg-accent px-3 py-3 text-base font-semibold text-accent-contrast disabled:opacity-60"
            >
              Join with code
            </button>
          </form>
        </div>

        <div className="border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-muted">
            Starting a brand-new group instead?
          </h2>
          <form onSubmit={handleCreate} className="mt-3 space-y-3">
            <input
              type="text"
              required
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-base outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 w-full rounded-lg border border-accent px-3 py-3 text-base font-semibold text-accent disabled:opacity-60"
            >
              Create group
            </button>
          </form>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
