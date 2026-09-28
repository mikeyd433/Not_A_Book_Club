import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth/AuthProvider'

export type NotificationPrefs = {
  quiet_start?: string
  quiet_end?: string
  timezone?: string
}

export function useMyNotificationPrefs(groupId: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['notification-prefs', groupId, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_members')
        .select('notification_prefs')
        .eq('group_id', groupId)
        .eq('user_id', user!.id)
        .single()

      if (error) throw error
      return (data.notification_prefs ?? {}) as NotificationPrefs
    },
  })
}

export function useUpdateNotificationPrefs(groupId: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (prefs: NotificationPrefs) => {
      if (!user) throw new Error('Not signed in')

      const { error } = await supabase
        .from('group_members')
        .update({ notification_prefs: prefs })
        .eq('group_id', groupId)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-prefs', groupId, user?.id] })
    },
  })
}

export function useMyPushSubscriptionCount() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['push-subscription-count', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)

      if (error) throw error
      return count ?? 0
    },
  })
}
