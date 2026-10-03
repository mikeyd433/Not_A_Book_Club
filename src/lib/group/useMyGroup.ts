import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'

export type MyGroup = {
  id: string
  name: string
  invite_code: string
  role: 'admin' | 'member'
}

// The app ships with one group per person; if someone is ever in more than
// one, we just show the first. A group switcher is future work.
export function useMyGroup() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['my-group', user?.id],
    enabled: Boolean(user),
    queryFn: async (): Promise<MyGroup | null> => {
      // .eq('user_id', ...) is load-bearing, not redundant with RLS: the
      // group_members SELECT policy allows reading every member's row in
      // any group you belong to (Settings' member list needs that), not
      // just your own. Without this filter, .limit(1) returned whichever
      // row PostgREST happened to order first -- invisible with a single
      // real member, but as soon as a second one (e.g. a test account)
      // existed, it could hand back someone else's role entirely.
      const { data, error } = await supabase
        .from('group_members')
        .select('role, groups(id, name, invite_code)')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (!data || !data.groups) return null

      return {
        id: data.groups.id,
        name: data.groups.name,
        invite_code: data.groups.invite_code,
        role: data.role as 'admin' | 'member',
      }
    },
  })
}
