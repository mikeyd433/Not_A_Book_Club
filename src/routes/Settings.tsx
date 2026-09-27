import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MyGroup } from '@/lib/group/useMyGroup'

export default function Settings({ group }: { group: MyGroup }) {
  const queryClient = useQueryClient()
  const inviteUrl = `${window.location.origin}/nabc/?invite=${group.invite_code}`

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

  return (
    <div className="space-y-6">
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
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted">Members</h2>
        <ul className="mt-2 space-y-1">
          {members?.map((m) => (
            <li
              key={m.user_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {m.profiles?.display_name ?? 'Someone'}
              </span>
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
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
