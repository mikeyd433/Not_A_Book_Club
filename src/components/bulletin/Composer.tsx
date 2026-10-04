import { useEffect, useRef, useState } from 'react'
import GifPicker from '@/components/GifPicker'

export type ComposerSubmit = {
  body: string
  photo?: File | null
  gifUrl?: string | null
}

export default function Composer({
  onSubmit,
  compact = false,
}: {
  onSubmit: (input: ComposerSubmit) => Promise<void>
  compact?: boolean
}) {
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [pickingGif, setPickingGif] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // Same expand-on-focus / collapse-on-outside-click behavior as the
  // discussion composer -- see its own note on why the tutorial overlay is
  // exempted from the outside-click check.
  const [expanded, setExpanded] = useState(false)
  const showControls = expanded || Boolean(body.trim()) || Boolean(photo) || Boolean(gifUrl)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!expanded) return
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (containerRef.current?.contains(target)) return
      if ((target as Element)?.closest?.('[data-tutorial-overlay]')) return
      setExpanded(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [expanded])

  async function handleSubmit() {
    if (!body.trim() || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await onSubmit({ body: body.trim(), photo, gifUrl })
      setBody('')
      setPhoto(null)
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
      setPhotoPreviewUrl(null)
      setGifUrl(null)
      setShowAttachMenu(false)
      setExpanded(false)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to post — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handlePhotoChange(file: File | null) {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhoto(file)
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null)
    if (file) setGifUrl(null) // one attachment per post
  }

  function handlePickGif(url: string) {
    setGifUrl(url)
    handlePhotoChange(null)
    setPickingGif(false)
  }

  return (
    <div ref={containerRef} className={compact ? '' : 'rounded-card bg-surface p-3'}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => setExpanded(true)}
        placeholder="Share something with the group…"
        className="w-full rounded-lg border border-border p-2 text-base"
        rows={2}
      />

      {photoPreviewUrl && (
        <div className="relative mt-2 inline-block">
          <img src={photoPreviewUrl} alt="" className="max-h-40 rounded-lg" />
          <button
            onClick={() => handlePhotoChange(null)}
            className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-xs text-white"
          >
            ✕
          </button>
        </div>
      )}

      {gifUrl && (
        <div className="relative mt-2 inline-block">
          <img src={gifUrl} alt="" className="max-h-40 rounded-lg" />
          <button
            onClick={() => setGifUrl(null)}
            className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-xs text-white"
          >
            ✕
          </button>
        </div>
      )}

      {pickingGif && <GifPicker onPick={handlePickGif} onCancel={() => setPickingGif(false)} />}

      {showControls && (
        <>
          <div className="mt-2 flex items-center gap-2">
            {showAttachMenu ? (
              <>
                <label className="min-h-9 cursor-pointer rounded-md px-2 py-1.5 text-xs text-accent">
                  📷 Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      handlePhotoChange(e.target.files?.[0] ?? null)
                      setShowAttachMenu(false)
                    }}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => {
                    setPickingGif((p) => !p)
                    setShowAttachMenu(false)
                  }}
                  className="min-h-9 rounded-md px-2 py-1.5 text-xs text-accent"
                >
                  🎬 GIF
                </button>
                <button
                  onClick={() => setShowAttachMenu(false)}
                  className="min-h-9 rounded-md px-2 py-1.5 text-xs text-muted"
                  aria-label="Cancel attach"
                >
                  ✕
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAttachMenu(true)}
                className="min-h-9 rounded-md px-2 py-1.5 text-xs text-accent"
              >
                📎 Attach
              </button>
            )}
          </div>

          {submitError && <p className="mt-1 text-xs text-red-600">{submitError}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-1 min-h-10 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-contrast disabled:opacity-60"
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </>
      )}
    </div>
  )
}
