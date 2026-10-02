import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  useMyNotificationPrefs,
  useUpdateNotificationPrefs,
} from '@/lib/notifications/queries'
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/notifications/push'
import { isIOS, promptInstall, useInstallPrompt } from '@/lib/pwaInstall'
import type { MyGroup } from '@/lib/group/useMyGroup'

export default function Settings({ group }: { group: MyGroup }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const inviteUrl = `${window.location.origin}/nabc/?invite=${group.invite_code}`
  const [memberError, setMemberError] = useState('')

  const { data: members } = useQuery({
    queryKey: ['group-members', group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, role, profiles(display_name)')
        .eq('group_id', group.id)

      if (error) throw error
      return data
    },
  })

  async function promote(userId: string) {
    await supabase
      .from('group_members')
      .update({ role: 'admin' })
      .eq('group_id', group.id)
      .eq('user_id', userId)
    queryClient.invalidateQueries({ queryKey: ['group-members', group.id] })
  }

  async function removeMember(userId: string, displayName: string) {
    if (!window.confirm(`Remove ${displayName} from the group?`)) return
    setMemberError('')

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', group.id)
      .eq('user_id', userId)

    // The last-admin guard trigger raises a plain Postgres exception --
    // its message is already written for a human, just surface it as-is.
    if (error) {
      setMemberError(error.message)
      return
    }
    queryClient.invalidateQueries({ queryKey: ['group-members', group.id] })
  }

  const regenerateCode = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('regenerate_invite_code', {
        p_group_id: group.id,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-group', user?.id] })
    },
  })

  function handleRegenerateCode() {
    if (
      !window.confirm(
        'Generate a new invite code? The current code will stop working immediately.',
      )
    ) {
      return
    }
    regenerateCode.mutate()
  }

  const pushSupported = isPushSupported()
  const { data: subscription } = useQuery({
    queryKey: ['push-subscription'],
    enabled: pushSupported,
    queryFn: getExistingSubscription,
  })
  const [pushError, setPushError] = useState('')

  const togglePush = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        await subscribeToPush(user!.id)
      } else {
        await unsubscribeFromPush()
      }
    },
    onSuccess: () => {
      setPushError('')
      queryClient.invalidateQueries({ queryKey: ['push-subscription'] })
    },
    onError: (err: Error) => setPushError(err.message),
  })

  const { data: prefs } = useMyNotificationPrefs(group.id)
  const updatePrefs = useUpdateNotificationPrefs(group.id)

  const installState = useInstallPrompt()
  const showManualInstallHint = !installState.installed && !installState.canPrompt && isIOS()

  return (
    <div className="space-y-6">
      {(installState.canPrompt || showManualInstallHint) && (
        <div className="rounded-card bg-surface p-3">
          <p className="text-sm font-semibold">📲 Install the app</p>
          <p className="mt-1 text-xs text-muted">
            Add Not A Book Club to your home screen for quick access, like a
            regular app.
          </p>
          {installState.canPrompt ? (
            <button
              onClick={() => promptInstall()}
              className="mt-2 min-h-11 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast"
            >
              Install app
            </button>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Tap the Share icon in Safari, then "Add to Home Screen".
            </p>
          )}
        </div>
      )}

      <div>
        <h1 className="text-lg font-bold">{group.name}</h1>
        <p className="text-sm text-muted">Invite code</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="min-h-11 rounded-lg bg-surface-alt px-3 py-2 text-sm font-bold leading-7 tracking-wide">
            {group.invite_code}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(inviteUrl)}
            className="min-h-11 rounded-lg border border-border px-3 py-2 text-xs"
          >
            Copy invite link
          </button>
          {group.role === 'admin' && (
            <button
              onClick={handleRegenerateCode}
              disabled={regenerateCode.isPending}
              className="min-h-11 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-60"
            >
              Regenerate
            </button>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted">Members</h2>
        <ul className="mt-2 space-y-1">
          {members?.map((m) => {
            const displayName = m.profiles?.display_name ?? 'Someone'
            const isSelf = m.user_id === user?.id
            return (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{displayName}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted">{m.role}</span>
                  {group.role === 'admin' && m.role !== 'admin' && (
                    <button
                      onClick={() => promote(m.user_id)}
                      className="min-h-9 rounded-full border border-accent px-3 py-1.5 text-xs text-accent"
                    >
                      Make admin
                    </button>
                  )}
                  {group.role === 'admin' && !isSelf && (
                    <button
                      onClick={() => removeMember(m.user_id, displayName)}
                      className="min-h-9 rounded-full border border-border px-3 py-1.5 text-xs text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        {memberError && <p className="mt-2 text-xs text-red-600">{memberError}</p>}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted">Notifications</h2>
        {!pushSupported ? (
          <p className="mt-2 rounded-lg bg-surface-alt p-3 text-xs text-muted">
            Push notifications aren't supported in this browser.
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            <label className="flex min-h-11 items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
              <span>New comments on books you're reading</span>
              <input
                type="checkbox"
                checked={Boolean(subscription)}
                onChange={(e) => togglePush.mutate(e.target.checked)}
                className="size-5"
              />
            </label>
            {pushError && <p className="text-xs text-red-600">{pushError}</p>}

            <div className="rounded-lg bg-surface p-3">
              <p className="text-xs font-semibold text-muted">Quiet hours</p>
              <p className="mt-0.5 text-xs text-muted">
                Notifications during this window are delivered right after it
                ends, not dropped.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="time"
                  value={prefs?.quiet_start ?? ''}
                  onChange={(e) =>
                    updatePrefs.mutate({
                      ...prefs,
                      quiet_start: e.target.value,
                      timezone:
                        prefs?.timezone ??
                        Intl.DateTimeFormat().resolvedOptions().timeZone,
                    })
                  }
                  className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-base"
                />
                <span className="text-xs text-muted">to</span>
                <input
                  type="time"
                  value={prefs?.quiet_end ?? ''}
                  onChange={(e) =>
                    updatePrefs.mutate({
                      ...prefs,
                      quiet_end: e.target.value,
                      timezone:
                        prefs?.timezone ??
                        Intl.DateTimeFormat().resolvedOptions().timeZone,
                    })
                  }
                  className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-base"
                />
              </div>
              {prefs?.quiet_start && (
                <button
                  onClick={() => updatePrefs.mutate({})}
                  className="mt-2 text-xs text-accent"
                >
                  Clear quiet hours
                </button>
              )}
            </div>

            <p className="text-xs text-muted">
              Mute individual books from that book's page.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
