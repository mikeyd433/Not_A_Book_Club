import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import {
  useMyProfile,
  useRemoveAvatar,
  useUpdateDisplayName,
  useUploadAvatar,
} from '@/lib/profile/queries'
import { setTheme, useTheme, type ThemePreference } from '@/lib/theme'
import { useTutorial } from '@/lib/tutorial/TutorialProvider'
import Avatar from '@/components/Avatar'
import TestAccountsPanel from '@/components/TestAccountsPanel'
import type { MyGroup } from '@/lib/group/useMyGroup'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export default function Settings({ group }: { group: MyGroup }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const tutorial = useTutorial()
  const inviteUrl = `${window.location.origin}/nabc/?invite=${group.invite_code}`
  const [memberError, setMemberError] = useState('')

  const { data: members } = useQuery({
    queryKey: ['group-members', group.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('user_id, role, profiles(display_name, avatar_url, is_test_account)')
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
  const theme = useTheme()

  return (
    <div className="space-y-6">
      <ProfileField />

      <div>
        <h2 className="text-sm font-semibold text-muted">Appearance</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium ${
                theme === opt.value
                  ? 'bg-accent text-accent-contrast'
                  : 'border border-border bg-surface text-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

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

      <div data-tour="invite-code">
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

      <button
        onClick={() => tutorial.start()}
        data-tour="replay-tutorial"
        className="flex min-h-11 w-full items-center justify-between rounded-card bg-surface px-3 py-2 text-left text-sm font-semibold active:bg-surface-alt"
      >
        🎓 Replay tutorial
        <span className="text-muted">→</span>
      </button>

      <div>
        <h2 className="text-sm font-semibold text-muted">Members</h2>
        <ul className="mt-2 space-y-1">
          {members?.map((m) => {
            const displayName = m.profiles?.display_name ?? 'Someone'
            const isSelf = m.user_id === user?.id
            const isTestAccount = Boolean(m.profiles?.is_test_account)
            return (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm"
              >
                <Link
                  to={`/member/${m.user_id}`}
                  className="flex min-w-0 items-center gap-2"
                >
                  <Avatar path={m.profiles?.avatar_url} name={displayName} size={28} />
                  <span className="truncate">
                    {displayName}
                    {m.profiles?.is_test_account && (
                      <span className="ml-1.5 text-xs text-muted">🧪 test</span>
                    )}
                  </span>
                </Link>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted">{m.role}</span>
                  {group.role === 'admin' && m.role !== 'admin' && !isTestAccount && (
                    <button
                      onClick={() => promote(m.user_id)}
                      className="min-h-9 rounded-full border border-accent px-3 py-1.5 text-xs text-accent"
                    >
                      Make admin
                    </button>
                  )}
                  {group.role === 'admin' && !isSelf && !isTestAccount && (
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

      {group.role === 'admin' && <TestAccountsPanel />}

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

function ProfileField() {
  const { data: profile } = useMyProfile()
  const updateName = useUpdateDisplayName()
  const uploadAvatar = useUploadAvatar()
  const removeAvatar = useRemoveAvatar()
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  // Sync the input once the fetched name arrives, then leave it alone --
  // otherwise a background refetch (e.g. after a mutation elsewhere)
  // would stomp on text someone's mid-edit.
  const [synced, setSynced] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarError, setAvatarError] = useState('')

  useEffect(() => {
    if (profile && !synced) {
      setName(profile.display_name)
      setSynced(true)
    }
  }, [profile, synced])

  async function handleSaveName() {
    setSaved(false)
    try {
      await updateName.mutateAsync(name)
      setSaved(true)
    } catch {
      // Surfaced below via updateName.error.
    }
  }

  async function handlePhotoChosen(file: File | undefined) {
    if (!file) return
    setAvatarError('')
    try {
      await uploadAvatar.mutateAsync(file)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to upload photo.')
    }
  }

  async function handleRemovePhoto() {
    if (!profile?.avatar_url) return
    setAvatarError('')
    try {
      await removeAvatar.mutateAsync(profile.avatar_url)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to remove photo.')
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted">Profile</h2>

      <div className="mt-2 flex items-center gap-3">
        <Avatar path={profile?.avatar_url} name={name || 'Someone'} size={56} />
        <div className="flex flex-col items-start gap-1">
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadAvatar.isPending}
            className="min-h-9 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          >
            {uploadAvatar.isPending ? 'Uploading…' : '📷 Change photo'}
          </button>
          {profile?.avatar_url && (
            <button
              onClick={handleRemovePhoto}
              disabled={removeAvatar.isPending}
              className="min-h-9 px-3 text-xs text-red-600 disabled:opacity-60"
            >
              Remove photo
            </button>
          )}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void handlePhotoChosen(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {avatarError && <p className="mt-1 text-xs text-red-600">{avatarError}</p>}

      <p className="mt-3 text-xs text-muted">
        Shown on your comments and in the member list, instead of your email.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
          maxLength={60}
          className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-2 py-2 text-base"
        />
        <button
          onClick={handleSaveName}
          disabled={updateName.isPending || !name.trim()}
          className="min-h-11 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60"
        >
          {updateName.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {saved && !updateName.isPending && (
        <p className="mt-1 text-xs text-muted">Saved.</p>
      )}
      {updateName.isError && (
        <p className="mt-1 text-xs text-red-600">
          {updateName.error instanceof Error
            ? updateName.error.message
            : 'Failed to save.'}
        </p>
      )}
    </div>
  )
}
