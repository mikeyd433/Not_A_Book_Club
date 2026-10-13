import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { consumePendingInvite } from '@/lib/pendingInvite'
import { setActiveGroupId } from '@/lib/group/activeGroup'
import {
  applyCrossGroupMatches,
  findCrossGroupMatches,
  useMyGroups,
  type CrossGroupMatch,
} from '@/lib/group/useMyGroup'
import { supabase } from '@/lib/supabase'

const IN_PROGRESS_STATUSES = new Set(['reading', 'paused'])

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

  // Set the moment a join succeeds if that group turns out to share any
  // books (by open_library_id) the person has already shelved -- finished,
  // DNF'd, or still partway through -- in another group. Swaps the whole
  // screen for the checkbox picker below instead of landing them straight
  // in the new group, same screen either way whether they came here via
  // invite link or Settings' "Join or create another group."
  const [pendingJoin, setPendingJoin] = useState<{
    groupId: string
    matches: CrossGroupMatch[]
    selected: Set<string>
  } | null>(null)
  const [applying, setApplying] = useState(false)

  async function handleJoin(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { data, error: rpcError } = await supabase.rpc('join_group_by_code', {
      p_invite_code: inviteCode.trim(),
    })

    if (rpcError) {
      setBusy(false)
      setError(rpcError.message)
      return
    }

    // Not worth blocking the join over -- if this lookup itself fails,
    // just land them in the group as before rather than getting stuck.
    let matches: CrossGroupMatch[] = []
    try {
      matches = await findCrossGroupMatches(data.id)
    } catch {
      // fall through with matches == []
    }

    setBusy(false)

    if (matches.length > 0) {
      setPendingJoin({
        groupId: data.id,
        matches,
        selected: new Set(matches.map((m) => m.new_book_id)),
      })
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

    // A brand-new group has no books in it yet -- nothing to match.
    setActiveGroupId(data.id)
  }

  function toggleMatch(bookId: string) {
    setPendingJoin((prev) => {
      if (!prev) return prev
      const next = new Set(prev.selected)
      if (next.has(bookId)) next.delete(bookId)
      else next.add(bookId)
      return { ...prev, selected: next }
    })
  }

  async function handleConfirmTransfer() {
    if (!pendingJoin) return
    setApplying(true)
    if (pendingJoin.selected.size > 0) {
      try {
        await applyCrossGroupMatches(pendingJoin.groupId, [...pendingJoin.selected])
      } catch {
        // Not worth stalling here either -- worst case they just have to
        // re-mark these books read manually from the new group's shelf.
      }
    }
    setActiveGroupId(pendingJoin.groupId)
  }

  if (pendingJoin) {
    const allSelected = pendingJoin.selected.size === pendingJoin.matches.length
    const inProgress = pendingJoin.matches.filter((m) => IN_PROGRESS_STATUSES.has(m.old_status))
    const alreadyRead = pendingJoin.matches.filter((m) => !IN_PROGRESS_STATUSES.has(m.old_status))
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm space-y-6 rounded-card bg-surface p-8 shadow-sm">
          <div>
            <h1 className="text-xl font-bold">Bring your shelf along?</h1>
            <p className="mt-1 text-sm text-muted">
              These are already on your shelf in another group. Check any you'd
              like added here too.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {pendingJoin.selected.size} of {pendingJoin.matches.length} selected
            </span>
            <button
              onClick={() =>
                setPendingJoin((prev) =>
                  prev
                    ? {
                        ...prev,
                        selected: allSelected
                          ? new Set()
                          : new Set(prev.matches.map((m) => m.new_book_id)),
                      }
                    : prev,
                )
              }
              className="text-xs font-semibold text-accent"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="max-h-80 space-y-4 overflow-y-auto">
            {inProgress.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Currently reading
                </h2>
                <ul className="mt-2 space-y-2">
                  {inProgress.map((m) => (
                    <MatchRow
                      key={m.new_book_id}
                      match={m}
                      checked={pendingJoin.selected.has(m.new_book_id)}
                      onToggle={() => toggleMatch(m.new_book_id)}
                    />
                  ))}
                </ul>
              </div>
            )}
            {alreadyRead.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Already read
                </h2>
                <ul className="mt-2 space-y-2">
                  {alreadyRead.map((m) => (
                    <MatchRow
                      key={m.new_book_id}
                      match={m}
                      checked={pendingJoin.selected.has(m.new_book_id)}
                      onToggle={() => toggleMatch(m.new_book_id)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveGroupId(pendingJoin.groupId)}
              disabled={applying}
              className="min-h-11 flex-1 rounded-lg border border-border px-3 py-3 text-sm font-semibold disabled:opacity-60"
            >
              Skip
            </button>
            <button
              onClick={handleConfirmTransfer}
              disabled={applying || pendingJoin.selected.size === 0}
              className="min-h-11 flex-1 rounded-lg bg-accent px-3 py-3 text-sm font-semibold text-accent-contrast disabled:opacity-60"
            >
              {applying
                ? 'Adding…'
                : `Add ${pendingJoin.selected.size} book${
                    pendingJoin.selected.size === 1 ? '' : 's'
                  }`}
            </button>
          </div>
        </div>
      </div>
    )
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
              {busy ? 'Joining…' : 'Join with code'}
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

function MatchRow({
  match,
  checked,
  onToggle,
}: {
  match: CrossGroupMatch
  checked: boolean
  onToggle: () => void
}) {
  const statusLabel =
    match.old_status === 'dnf'
      ? 'Did not finish'
      : match.old_status === 'reading'
        ? 'Reading'
        : match.old_status === 'paused'
          ? 'Paused'
          : 'Read'

  return (
    <li>
      <label className="flex items-start gap-3 rounded-lg bg-surface-alt p-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 size-5 flex-shrink-0"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{match.title}</span>
          {match.author && <span className="block text-xs text-muted">{match.author}</span>}
          <span className="block text-xs text-muted">
            {statusLabel}
            {match.old_chapter_label && ` · ${match.old_chapter_label}`} in {match.old_group_name}
          </span>
        </span>
      </label>
    </li>
  )
}
