import { avatarPublicUrl } from '@/lib/profile/queries'

export default function Avatar({
  path,
  name,
  size = 32,
  className = '',
  cacheBust,
}: {
  path?: string | null
  name: string
  size?: number
  className?: string
  // Avatars reuse one fixed storage path per user (overwritten on every
  // re-upload, unlike covers/comment photos which each get a fresh random
  // path) -- so the URL never changes on its own, and neither the browser
  // nor React has any reason to re-fetch it after a new crop is uploaded.
  // profiles.avatar_updated_at (set on every upload) gives every render of
  // someone's avatar, anywhere in the app, a URL that actually changes
  // when their photo does -- pass it whenever the data it came from is in
  // scope; a caller that doesn't have it (or doesn't care) can just omit
  // it and render exactly as before.
  cacheBust?: string | null
}) {
  if (path) {
    const src = cacheBust
      ? `${avatarPublicUrl(path)}?v=${encodeURIComponent(cacheBust)}`
      : avatarPublicUrl(path)
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className={`flex-shrink-0 rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-contrast ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  )
}
