import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { consumePendingInvite } from '@/lib/pendingInvite'
import { setActiveGroupId } from '@/lib/group/activeGroup'
import {
  applyShelfTransfer,
  findShelfTransferCandidates,
  useMyGroups,
  type ShelfTransferCandidate,
} from '@/lib/group/useMyGroup'
import { supabase } from '@/lib/supabase'

const IN_PROGRESS_STATUSES = new Set(['reading', 'paused'])
const ALREADY_READ_STATUSES = new Set(['finished', 'read_before_joining', 'dnf'])

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

  // Set the moment a join succeeds if the person has anything at all on
  // their shelf in another group -- every status, whether or not that
  // book already exists in the group they just joined (see
  // ShelfTransferCandidate). Swaps the whole screen for the checkbox
  // picker below instead of landing them straight in the new group, same
  // screen either way whether they came here via invite link or
  // Settings' "Join or create another group."
  const [pendingJoin, setPendingJoin] = useState<{
    groupId: string
    candidates: ShelfTransferCandidate[]
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
    let candidates: ShelfTransferCandidate[] = []
    try {
      candidates = await findShelfTransferCandidates(data.id)
    } catch {
      // fall through with candidates == []
    }

    setBusy(false)

    if (candidates.length > 0) {
      setPendingJoin({
        groupId: data.id,
        candidates,
        selected: new Set(candidates.map((c) => c.old_book_id)),
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
        await applyShelfTransfer(pendingJoin.groupId, [...pendingJoin.selected])
      } catch {
        // Not worth stalling here either -- worst case they just have to
        // re-add these books manually from the new group's shelf.
      }
    }
    setActiveGroupId(pendingJoin.groupId)
  }

  if (pendingJoin) {
    const allSelected = pendingJoin.selected.size === pendingJoin.candidates.length
    const inProgress = pendingJoin.candidates.filter((c) => IN_PROGRESS_STATUSES.has(c.old_status))
    const wantToRead = pendingJoin.candidates.filter((c) => c.old_status === 'want_to_read')
    const alreadyRead = pendingJoin.candidates.filter((c) => ALREADY_READ_STATUSES.has(c.old_status))
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm space-y-6 rounded-card bg-surface p-8 shadow-sm">
          <div>
            <h1 className="text-xl font-bold">Bring your shelf along?</h1>
            <p className="mt-1 text-sm text-muted">
              Your whole shelf from your other groups, checked by default --
              uncheck anything you don't want added here too.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {pendingJoin.selected.size} of {pendingJoin.candidates.length} selected
            </span>
            <button
              onClick={() =>
                setPendingJoin((prev) =>
                  prev
                    ? {
                        ...prev,
                        selected: allSelected
                          ? new Set()
                          : new Set(prev.candidates.map((c) => c.old_book_id)),
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
                  {inProgress.map((c) => (
                    <CandidateRow
                      key={c.old_book_id}
                      candidate={c}
                      checked={pendingJoin.selected.has(c.old_book_id)}
                      onToggle={() => toggleMatch(c.old_book_id)}
                    />
                  ))}
                </ul>
              </div>
            )}
            {wantToRead.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Want to read
                </h2>
                <ul className="mt-2 space-y-2">
                  {wantToRead.map((c) => (
                    <CandidateRow
                      key={c.old_book_id}
                      candidate={c}
                      checked={pendingJoin.selected.has(c.old_book_id)}
                      onToggle={() => toggleMatch(c.old_book_id)}
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
                  {alreadyRead.map((c) => (
                    <CandidateRow
                      key={c.old_book_id}
                      candidate={c}
                      checked={pendingJoin.selected.has(c.old_book_id)}
                      onToggle={() => toggleMatch(c.old_book_id)}
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

const STATUS_LABELS: Record<string, string> = {
  dnf: 'Did not finish',
  reading: 'Reading',
  paused: 'Paused',
  want_to_read: 'Want to read',
  finished: 'Read',
  read_before_joining: 'Read',
}

function CandidateRow({
  candidate,
  checked,
  onToggle,
}: {
  candidate: ShelfTransferCandidate
  checked: boolean
  onToggle: () => void
}) {
  const statusLabel = STATUS_LABELS[candidate.old_status] ?? 'On your shelf'

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
          <span className="block text-sm font-semibold">{candidate.title}</span>
          {candidate.author && (
            <span className="block text-xs text-muted">{candidate.author}</span>
          )}
          <span className="block text-xs text-muted">
            {statusLabel}
            {candidate.old_chapter_label && ` · ${candidate.old_chapter_label}`} in{' '}
            {candidate.old_group_name}
          </span>
        </span>
      </label>
    </li>
  )
}
