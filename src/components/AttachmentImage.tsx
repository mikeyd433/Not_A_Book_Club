import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// comment-attachments is a private bucket (unlike covers) since a photo is
// exactly as spoiler-sensitive as the comment it's on — so this resolves a
// signed URL through the same RLS-gated path as any other read, rather
// than a public getPublicUrl() that would bypass it entirely.
export default function AttachmentImage({ path }: { path: string }) {
  const { data: url } = useQuery({
    queryKey: ['attachment-url', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('comment-attachments')
        .createSignedUrl(path, 3600)
      if (error) throw error
      return data.signedUrl
    },
    staleTime: 50 * 60 * 1000,
  })

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
