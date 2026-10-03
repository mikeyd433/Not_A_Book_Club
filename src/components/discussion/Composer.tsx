import { useState } from 'react'
import type { ChapterOption } from '@/lib/books/queries'
import type { PendingSpoilerBlock } from '@/lib/comments/queries'
import GifPicker from './GifPicker'

export type ComposerSubmit = {
  chapterId: string
  body: string
  noSpoilers?: boolean
  spoilerBlocks?: PendingSpoilerBlock[]
  isPrediction?: boolean
  photo?: File | null
  gifUrl?: string | null
}

export default function Composer({
  chapters,
  defaultChapterId,
  onSubmit,
  compact = false,
}: {
  chapters: ChapterOption[]
  defaultChapterId: string | null
  onSubmit: (input: ComposerSubmit) => Promise<void>
  compact?: boolean
}) {
  const [chapterId, setChapterId] = useState(
    defaultChapterId ?? chapters[chapters.length - 1]?.id ?? '',
  )
  const [body, setBody] = useState('')
  const [noSpoilers, setNoSpoilers] = useState(false)
  const [isPrediction, setIsPrediction] = useState(false)
  const [spoilerBlocks, setSpoilerBlocks] = useState<PendingSpoilerBlock[]>([])
  const [addingSpoiler, setAddingSpoiler] = useState(false)
  const [spoilerChapterId, setSpoilerChapterId] = useState(chapterId)
  const [spoilerText, setSpoilerText] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [gifUrl, setGifUrl] = useState<string | null>(null)
  const [pickingGif, setPickingGif] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  // Keeps the box looking like a plain "share a thought" field until
  // someone actually taps in -- the no-spoilers/prediction toggles, attach/
  // spoiler buttons, and Post button only show up once engaged. Stays
  // expanded if there's unsent text/attachments even after losing focus
  // (clicking Attach itself blurs the textarea), and collapses again after
  // a successful post.
  const [expanded, setExpanded] = useState(false)
  const showControls =
    expanded || Boolean(body.trim()) || Boolean(photo) || Boolean(gifUrl)

  function handleInsertSpoiler() {
    if (!spoilerText.trim()) return
    const ordinal = spoilerBlocks.length + 1
    setSpoilerBlocks((blocks) => [
      ...blocks,
      { ordinal, chapterId: spoilerChapterId, content: spoilerText.trim() },
    ])
    setBody((b) => `${b}${b && !b.endsWith(' ') ? ' ' : ''}[spoiler #${ordinal}]`)
    setSpoilerText('')
    setAddingSpoiler(false)
  }

  async function handleSubmit() {
    if (!body.trim() || !chapterId || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await onSubmit({
        chapterId,
        body: body.trim(),
        noSpoilers,
        spoilerBlocks,
        isPrediction,
        photo,
        gifUrl,
      })
      // Only clear on confirmed success -- clearing unconditionally after a
      // fire-and-forget mutate() used to silently lose the user's text (and
      // any spoiler blocks/attachment) if the request failed partway.
      setBody('')
      setNoSpoilers(false)
      setIsPrediction(false)
      setSpoilerBlocks([])
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
    if (file) setGifUrl(null) // one attachment per comment
  }

  function handlePickGif(url: string) {
    setGifUrl(url)
    handlePhotoChange(null)
    setPickingGif(false)
  }

  return (
    <div className={compact ? '' : 'rounded-card bg-surface p-3'}>
      {chapters.length > 1 && (
        <div className="flex items-center gap-2">
          <select
            value={chapterId}
            onChange={(e) => {
              setChapterId(e.target.value)
              setSpoilerChapterId(e.target.value)
            }}
            className="min-h-11 rounded-lg border border-border bg-surface px-2 py-2 text-base"
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onFocus={() => setExpanded(true)}
        placeholder="Share a thought…"
        className="mt-2 w-full rounded-lg border border-border p-2 text-base"
        rows={compact ? 2 : 3}
      />

      {showControls && addingSpoiler && (
        <div className="mt-2 rounded-lg bg-surface-alt p-2">
          <p className="text-xs font-semibold">Insert a spoiler block</p>
          <select
            value={spoilerChapterId}
            onChange={(e) => setSpoilerChapterId(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface px-2 py-2 text-base"
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            value={spoilerText}
            onChange={(e) => setSpoilerText(e.target.value)}
            placeholder="Hidden text…"
            rows={2}
            className="mt-1 w-full rounded-lg border border-border p-2 text-base"
          />
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => setAddingSpoiler(false)}
              className="min-h-9 flex-1 rounded-md border border-border text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleInsertSpoiler}
              className="min-h-9 flex-1 rounded-md bg-accent text-xs font-semibold text-accent-contrast"
            >
              Insert
            </button>
          </div>
        </div>
      )}

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

      {pickingGif && (
        <GifPicker onPick={handlePickGif} onCancel={() => setPickingGif(false)} />
      )}

      {showControls && (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex min-h-9 items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={noSpoilers}
                onChange={(e) => setNoSpoilers(e.target.checked)}
                className="size-4"
              />
              ❓ No spoilers please
            </label>
            <label className="flex min-h-9 items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={isPrediction}
                onChange={(e) => setIsPrediction(e.target.checked)}
                className="size-4"
              />
              🔮 Mark as a prediction
            </label>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
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
              <button
                onClick={() => setAddingSpoiler((a) => !a)}
                className="min-h-9 rounded-md px-2 py-1.5 text-xs text-accent"
              >
                🙈 Insert spoiler
              </button>
            </div>
          </div>

          {submitError && (
            <p className="mt-1 text-xs text-red-600">{submitError}</p>
          )}
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
