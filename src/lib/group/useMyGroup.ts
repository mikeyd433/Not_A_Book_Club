import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'
import { getActiveGroupId } from './activeGroup'

export type MyGroup = {
  id: string
  name: string
  invite_code: string
  role: 'admin' | 'member'
}

// Every group the signed-in person belongs to, oldest-joined first (so
// "the first one" stays a stable, predictable default for useMyGroup()
// below rather than depending on query ordering). Settings' group
// switcher renders the full list; useMyGroup() picks one out of it.
export function useMyGroups() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-groups', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<MyGroup[]> => {
      // .eq('user_id', ...) is load-bearing, not redundant with RLS: the
      // group_members SELECT policy allows reading every member's row in
      // any group you belong to (Settings' member list needs that), not
      // just your own.
      const { data, error } = await supabase
        .from('group_members')
        .select('role, joined_at, groups(id, name, invite_code)')
        .eq('user_id', user!.id)
        .order('joined_at', { ascending: true })

      if (error) throw error

      return (data ?? [])
        .filter((row): row is typeof row & { groups: NonNullable<typeof row.groups> } =>
          Boolean(row.groups),
        )
        .map((row) => ({
          id: row.groups.id,
          name: row.groups.name,
          invite_code: row.groups.invite_code,
          role: row.role as 'admin' | 'member',
        }))
    },
  })
}

// The group everything else in the app renders against -- the stored
// active choice (activeGroup.ts) if it's still one the person belongs to,
// else the oldest-joined as a stable fallback (covers never having picked
// one yet, and being removed from whichever group was last active).
// Reads the active id directly rather than through its own
// useSyncExternalStore subscription: the only way it ever changes is
// setActiveGroupId(), which always hard-reloads, so there's nothing to
// react to within a single page life -- same reasoning
// getActiveTestAccount() is read once in Layout.tsx.
export function useMyGroup() {
  const { data: groups, isLoading, error } = useMyGroups()

  if (!groups) {
    return { data: undefined as MyGroup | null | undefined, isLoading, error }
  }

  const activeId = getActiveGroupId()
  const data = groups.find((g) => g.id === activeId) ?? groups[0] ?? null
  return { data, isLoading, error }
}

// Admin-only at the RLS level (0045's "admins can update their group"
// policy) -- a non-admin's call fails server-side even though nothing
// client-side besides Settings' own admin check stops them from trying.
export function useUpdateGroupName(groupId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('groups').update({ name }).eq('id', groupId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups', user?.id] })
    },
  })
}

export type CrossGroupReadMatch = {
  new_book_id: string
  title: string
  author: string | null
  old_status: string
  old_group_name: string
}

// Called once, right after joining a group (JoinOrCreateGroup.tsx) -- not
// a useQuery hook, since it only ever needs to run that one time rather
// than stay live/cached. Books already marked finished/read-before-
// joining/DNF elsewhere, matched by open_library_id (see the
// 0050_cross_group_read_matches migration for why that's the only
// reliable identifier).
export async function findCrossGroupReadMatches(
  groupId: string,
): Promise<CrossGroupReadMatch[]> {
  const { data, error } = await supabase.rpc('find_cross_group_read_matches', {
    p_group_id: groupId,
  })
  if (error) throw error
  return data
}

// Applies whichever of those matches the person checked -- the RPC
// re-derives the legitimate match set itself rather than trusting these
// book ids blindly, so this can't be used to backdate an arbitrary book.
export async function applyCrossGroupReadMatches(groupId: string, bookIds: string[]) {
  const { error } = await supabase.rpc('apply_cross_group_read_matches', {
    p_group_id: groupId,
    p_book_ids: bookIds,
  })
  if (error) throw error
}
