import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Reached after login when the signed-in user isn't in a group yet. If they
// arrived via an invite link (?invite=CODE) the code is pre-filled; the
// "create a group" option only really matters for the very first person.
export default function JoinOrCreateGroup() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [inviteCode, setInviteCode] = useState(
    searchParams.get('invite')?.toUpperCase() ?? '',
  )
  const [groupName, setGroupName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('join_group_by_code', {
      p_invite_code: inviteCode.trim(),
    })

    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['my-group'] })
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('create_group', {
      p_name: groupName.trim(),
    })

    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }

    queryClient.invalidateQueries({ queryKey: ['my-group'] })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-8 rounded-card bg-surface p-8 shadow-sm">
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
