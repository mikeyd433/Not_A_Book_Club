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
      const { data, error } = await supabase
        .from('group_members')
        .select('role, groups(id, name, invite_code)')
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
