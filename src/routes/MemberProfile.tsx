import { useParams } from 'react-router-dom'
import { useMemberProfile } from '@/lib/profile/queries'
import Avatar from '@/components/Avatar'
import ProfileActivity from '@/components/profile/ProfileActivity'
import QueryError from '@/components/QueryError'

export default function MemberProfile() {
  const { userId } = useParams<{ userId: string }>()
  const { data: profile, isError, error, refetch } = useMemberProfile(userId!)

  if (isError) return <QueryError error={error} onRetry={() => refetch()} />
  if (!profile) return <p className="text-sm text-muted">Loading…</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar
          path={profile.avatar_url}
          name={profile.display_name}
          size={56}
          cacheBust={profile.avatar_updated_at}
        />
        <h1 className="text-lg font-bold">{profile.display_name}</h1>
      </div>

      <ProfileActivity userId={userId!} />
    </div>
  )
}
