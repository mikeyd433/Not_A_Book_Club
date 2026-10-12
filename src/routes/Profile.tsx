import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useMyProfile } from '@/lib/profile/queries'
import Avatar from '@/components/Avatar'
import ProfileActivity from '@/components/profile/ProfileActivity'

// Your own shelf + recent activity, same view MemberProfile gives for
// anyone else (ProfileActivity), reachable on its own rather than buried
// in Settings -- editing your name/photo still happens there, linked
// below, since this page is about what you've been up to, not account
// settings.
export default function Profile() {
  const { user } = useAuth()
  const { data: profile } = useMyProfile()

  if (!user || !profile) return <p className="text-sm text-muted">Loading…</p>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            path={profile.avatar_url}
            name={profile.display_name}
            size={56}
            cacheBust={profile.avatar_updated_at}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Your profile
            </p>
            <h1 className="truncate text-lg font-bold">{profile.display_name}</h1>
          </div>
        </div>
        <Link
          to="/settings"
          className="min-h-9 flex-shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-accent"
        >
          Edit
        </Link>
      </div>

      <ProfileActivity userId={user.id} />
    </div>
  )
}
