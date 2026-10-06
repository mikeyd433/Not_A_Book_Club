import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUploadCover } from '@/lib/covers/queries'
import CoverCropper from '@/components/CoverCropper'
import { convertHeicIfNeeded, fileToDataUrl } from '@/lib/image'

// The "add a cover" half of CoverGallery, pulled out so AddBook's
// just-created-a-book step can offer the same upload+crop tool without
// duplicating it -- CoverGallery still owns the grid of existing covers,
// picking a default/personal one, and deleting.
export default function CoverUploadPanel({ bookId }: { bookId: string }) {
  const queryClient = useQueryClient()
  const uploadCover = useUploadCover(bookId)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [error, setError] = useState('')
  const [uploadedCount, setUploadedCount] = useState(0)
  // HEIC photos (the default on iPhone) need converting to JPEG before
  // they're readable at all -- see convertHeicIfNeeded.
  const [convertingPhoto, setConvertingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChosen(file: File | undefined) {
    if (!file) return
    setError('')
    setConvertingPhoto(true)
    try {
      const converted = await convertHeicIfNeeded(file)
      setCropSrc(await fileToDataUrl(converted))
    } catch {
      setError(
        "Couldn't read that photo — it may be in a format this device can't convert. Try a different one.",
      )
    } finally {
      setConvertingPhoto(false)
    }
  }

  function handleLoadUrl() {
    if (!urlInput.trim()) return
    setError('')
    setCropSrc(urlInput.trim())
  }

  async function handleCropConfirm(blob: Blob, accent: { accent: string }) {
    const cover = await uploadCover.mutateAsync(blob)

    // The first cover uploaded auto-becomes the default (DB trigger), but
    // only *this* client has the accent color it computed while cropping --
    // carry it over now rather than re-fetching the image to recompute it.
    const { data: freshBook } = await supabase
      .from('books')
      .select('default_cover_id')
      .eq('id', bookId)
      .single()
    if (freshBook?.default_cover_id === cover.id) {
      await supabase
        .from('books')
        .update({ accent_color: accent.accent })
        .eq('id', bookId)
      queryClient.invalidateQueries({ queryKey: ['book', bookId] })
    }

    setCropSrc(null)
    setUrlInput('')
    setUploadedCount((n) => n + 1)
  }

  return (
    <div className="rounded-card bg-surface p-3">
      <p className="text-sm font-semibold">Cover</p>
      <p className="mt-1 text-xs text-muted">
        Every cover is cropped to about 2:3.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={convertingPhoto}
          className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {convertingPhoto ? 'Converting…' : '📷 Add photo'}
        </button>
      </div>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFileChosen(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <div className="mt-3 flex gap-2">
        <input
          type="url"
          placeholder="Or paste an image URL…"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className="min-h-11 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent"
        />
        <button
          onClick={handleLoadUrl}
          className="min-h-11 shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
        >
          Load
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {uploadedCount > 0 && (
        <p className="mt-2 text-xs text-muted">
          {uploadedCount} cover{uploadedCount === 1 ? '' : 's'} added.
        </p>
      )}

      {cropSrc && (
        <CoverCropper
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  )
}
