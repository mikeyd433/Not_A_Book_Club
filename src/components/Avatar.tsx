import { avatarPublicUrl } from '@/lib/profile/queries'

export default function Avatar({
  path,
  name,
  size = 32,
  className = '',
}: {
  path?: string | null
  name: string
  size?: number
  className?: string
}) {
  if (path) {
    return (
      <img
        src={avatarPublicUrl(path)}
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
