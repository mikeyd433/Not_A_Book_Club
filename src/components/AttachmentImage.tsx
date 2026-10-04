import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// comment-attachments (and bulletin-attachments) are private buckets
// (unlike covers) since a photo is exactly as spoiler-sensitive as the
// comment/post it's on — so an uploaded photo resolves a signed URL
// through the same RLS-gated path as any other read, rather than a public
// getPublicUrl() that would bypass it entirely. A GIF has no such bucket
// at all — it's hosted on Giphy's CDN, and the row carrying its URL is
// already gated by the same table RLS, so once a caller is allowed to see
// the row, the URL itself needs no further gating (same reasoning as Open
// Library cover URLs or the public covers bucket).
export default function AttachmentImage({
  path,
  gifUrl,
  bucket = 'comment-attachments',
}: {
  path?: string | null
  gifUrl?: string | null
  bucket?: 'comment-attachments' | 'bulletin-attachments'
}) {
  const { data: signedUrl } = useQuery({
    queryKey: ['attachment-url', bucket, path],
    enabled: Boolean(path),
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path!, 3600)
      if (error) throw error
      return data.signedUrl
    },
    staleTime: 50 * 60 * 1000,
  })

  const url = gifUrl ?? signedUrl
  if (!url) return null

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="mt-2 max-h-80 w-full rounded-lg object-cover"
    />
  )
}
