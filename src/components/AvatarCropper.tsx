import { useEffect, useRef, useState } from 'react'
import {
  AVATAR_EXPORT_SIZE,
  baseCoverScale,
  clampOffset,
  loadImage,
  renderCrop,
  type CropTransform,
} from '@/lib/image'

// Same drag/zoom/rotate crop pipeline as CoverCropper, just with a square
// frame instead of 2:3 -- the two share the underlying math (image.ts's
// baseCoverScale/clampOffset/renderCrop all take an explicit target
// width/height now, rather than a single hardcoded cover-shaped frame).
const FRAME = 220
const PREVIEW_SCALE = FRAME / AVATAR_EXPORT_SIZE

export default function AvatarCropper({
  imageSrc,
  onCancel,
  onConfirm,
}: {
  imageSrc: string
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState('')
  const [transform, setTransform] = useState<CropTransform>({
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
    rotationDeg: 0,
  })
  const [busy, setBusy] = useState(false)
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    loadImage(imageSrc)
      .then((img) => {
        if (cancelled) return
        setImage(img)
        setTransform({ offsetX: 0, offsetY: 0, zoom: 1, rotationDeg: 0 })
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Couldn't load that image — if it's from a URL, the site may not allow it. Try downloading and uploading it instead.",
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [imageSrc])

  function rotate() {
    if (!image) return
    setTransform((t) => {
      const rotationDeg = ((t.rotationDeg + 90) % 360) as CropTransform['rotationDeg']
      const next = { ...t, rotationDeg, offsetX: 0, offsetY: 0 }
      return { ...next, ...clampOffset(image, next, AVATAR_EXPORT_SIZE, AVATAR_EXPORT_SIZE) }
    })
  }

  function handlePointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      offsetX: transform.offsetX,
      offsetY: transform.offsetY,
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !image) return
    const dx = (e.clientX - dragRef.current.x) / PREVIEW_SCALE
    const dy = (e.clientY - dragRef.current.y) / PREVIEW_SCALE
    setTransform((t) => {
      const next = {
        ...t,
        offsetX: dragRef.current!.offsetX + dx,
        offsetY: dragRef.current!.offsetY + dy,
      }
      return { ...next, ...clampOffset(image, next, AVATAR_EXPORT_SIZE, AVATAR_EXPORT_SIZE) }
    })
  }

  function handlePointerUp() {
    dragRef.current = null
  }

  function handleZoom(zoom: number) {
    if (!image) return
    setTransform((t) => {
      const next = { ...t, zoom }
      return { ...next, ...clampOffset(image, next, AVATAR_EXPORT_SIZE, AVATAR_EXPORT_SIZE) }
    })
  }

  async function handleConfirm() {
    if (!image) return
    setBusy(true)
    try {
      const blob = await renderCrop(image, transform, AVATAR_EXPORT_SIZE, AVATAR_EXPORT_SIZE)
      onConfirm(blob)
    } catch {
      setError('Something went wrong exporting that crop. Try again.')
      setBusy(false)
    }
  }

  const scale = image
    ? baseCoverScale(image, transform.rotationDeg, AVATAR_EXPORT_SIZE, AVATAR_EXPORT_SIZE) *
      transform.zoom
    : 1

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-card bg-surface p-4">
        <h2 className="text-center text-sm font-semibold">Crop photo</h2>

        {error ? (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        ) : (
          <>
            <div
              className="relative mx-auto mt-4 touch-none select-none overflow-hidden rounded-lg bg-surface-alt"
              style={{ width: FRAME, height: FRAME }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {image && (
                <img
                  src={imageSrc}
                  alt=""
                  draggable={false}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    width: image.width * scale * PREVIEW_SCALE,
                    height: image.height * scale * PREVIEW_SCALE,
                    transform: `translate(-50%, -50%) translate(${
                      transform.offsetX * PREVIEW_SCALE
                    }px, ${transform.offsetY * PREVIEW_SCALE}px) rotate(${transform.rotationDeg}deg)`,
                  }}
                />
              )}
              {/* Dims everything outside a circle -- the exported file is
                  still the full square (same object-cover + rounded-full
                  CSS every other avatar already renders with), this is
                  just a preview of how it'll actually look once rendered
                  round. The box-shadow spread is the circular-cutout
                  trick: a transparent circle with a huge shadow that
                  covers the rest of the square. */}
              {image && (
                <div
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
                />
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              <span className="text-xs text-muted">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={transform.zoom}
                onChange={(e) => handleZoom(Number(e.target.value))}
                className="h-11 flex-1"
              />
              <button
                onClick={rotate}
                className="min-h-11 min-w-11 rounded-lg border border-border text-lg"
                aria-label="Rotate 90 degrees"
              >
                ⟳
              </button>
            </div>
          </>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-lg border border-border text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!image || busy || Boolean(error)}
            className="min-h-11 flex-1 rounded-lg bg-accent text-sm font-semibold text-accent-contrast disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Use this photo'}
          </button>
        </div>
      </div>
    </div>
  )
}
