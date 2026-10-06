// Client-side crop/rotate/accent-color pipeline for cover uploads. Every
// cover — camera, photo library, or a pasted URL — goes through the same
// export step so storage always holds a standardized ~2:3 JPEG, never the
// original arbitrary-shaped source.
import { supabase } from '@/lib/supabase'

export const EXPORT_WIDTH = 600
export const EXPORT_HEIGHT = 900 // 2:3
export const AVATAR_EXPORT_SIZE = 400 // 1:1

export type CropTransform = {
  // Pan, in export-canvas pixels, applied in screen space (after rotation).
  offsetX: number
  offsetY: number
  // Multiplier over the "cover the frame" base scale.
  zoom: number
  rotationDeg: 0 | 90 | 180 | 270
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load that image.'))
    img.src = src
  })
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

// The scale (in export-canvas units per source pixel) at which the image,
// accounting for rotation, fully covers the export frame with no gaps.
// targetWidth/targetHeight are the export frame's dimensions -- EXPORT_WIDTH/
// EXPORT_HEIGHT (2:3) for a cover, AVATAR_EXPORT_SIZE square for an avatar.
export function baseCoverScale(
  image: HTMLImageElement,
  rotationDeg: CropTransform['rotationDeg'],
  targetWidth: number,
  targetHeight: number,
) {
  const rotated = rotationDeg === 90 || rotationDeg === 270
  const w = rotated ? image.height : image.width
  const h = rotated ? image.width : image.height
  return Math.max(targetWidth / w, targetHeight / h)
}

// Keeps the image covering the frame — no empty gaps at the edges — for the
// current zoom/rotation.
export function clampOffset(
  image: HTMLImageElement,
  transform: CropTransform,
  targetWidth: number,
  targetHeight: number,
) {
  const scale = baseCoverScale(image, transform.rotationDeg, targetWidth, targetHeight) * transform.zoom
  const rotated = transform.rotationDeg === 90 || transform.rotationDeg === 270
  const effW = (rotated ? image.height : image.width) * scale
  const effH = (rotated ? image.width : image.height) * scale
  const maxX = Math.max(0, (effW - targetWidth) / 2)
  const maxY = Math.max(0, (effH - targetHeight) / 2)
  return {
    offsetX: Math.min(maxX, Math.max(-maxX, transform.offsetX)),
    offsetY: Math.min(maxY, Math.max(-maxY, transform.offsetY)),
  }
}

export function renderCrop(
  image: HTMLImageElement,
  transform: CropTransform,
  targetWidth: number,
  targetHeight: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  const scale = baseCoverScale(image, transform.rotationDeg, targetWidth, targetHeight) * transform.zoom

  ctx.save()
  ctx.translate(
    targetWidth / 2 + transform.offsetX,
    targetHeight / 2 + transform.offsetY,
  )
  ctx.rotate((transform.rotationDeg * Math.PI) / 180)
  ctx.drawImage(
    image,
    (-image.width * scale) / 2,
    (-image.height * scale) / 2,
    image.width * scale,
    image.height * scale,
  )
  ctx.restore()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export failed.'))),
      'image/jpeg',
      0.85,
    )
  })
}

// Average color of the image, downsampled, plus a readable text color to
// pair with it. Good enough as "the accent pulled from this cover" — not a
// vibrance-aware palette extraction, just a fast, dependency-free average.
export async function computeAccentColor(
  image: HTMLImageElement,
): Promise<{ accent: string; contrast: string }> {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    count++
  }
  r = Math.round(r / count)
  g = Math.round(g / count)
  b = Math.round(b / count)

  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  const accent = clampAccentForReadability(`#${toHex(r)}${toHex(g)}${toHex(b)}`)
  return { accent, contrast: contrastForHex(accent) }
}

// Downscales a photo attachment to a reasonable upload size, preserving
// aspect ratio (unlike the cover pipeline above, there's no fixed frame to
// crop to — a comment photo is just a photo).
export async function resizeForUpload(
  file: File,
  maxDim = 1600,
  quality = 0.85,
): Promise<Blob> {
  const dataUrl = await fileToDataUrl(file)
  const image = await loadImage(dataUrl)
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height))
  const width = Math.round(image.width * scale)
  const height = Math.round(image.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Export failed.'))),
      'image/jpeg',
      quality,
    )
  })
}

// Same accent sampling as the crop tool, but starting from a URL instead of
// an already-loaded <img> -- for covers that never go through a crop step
// (the auto-fetched Open Library cover). Resolves to null rather than
// throwing on a load/CORS failure, since this always runs as a best-effort
// side effect alongside something else that must still succeed without it.
//
// Confirmed live (2026-10-04): covers.openlibrary.org doesn't send
// Access-Control-Allow-Origin, so getImageData() always throws a
// SecurityError for it regardless of crossOrigin -- every book relying on
// its auto-fetched cover stayed untheme'd even after this function first
// shipped. For that one source specifically, fall back to the
// compute-cover-accent edge function, which samples the image server-side
// instead (a plain fetch() there isn't subject to CORS at all). Anything
// else failing here (our own public covers bucket, a bad URL, a transient
// load error) isn't a CORS problem and wouldn't be fixed by that fallback,
// so it stays out of scope for it.
export async function computeAccentColorFromUrl(
  url: string,
): Promise<{ accent: string; contrast: string } | null> {
  try {
    const image = await loadImage(url)
    return await computeAccentColor(image)
  } catch {
    if (!url.startsWith('https://covers.openlibrary.org/')) return null
    try {
      const { data, error } = await supabase.functions.invoke<{ accent: string }>(
        'compute-cover-accent',
        { body: { imageUrl: url } },
      )
      if (error || !data?.accent) return null
      const accent = clampAccentForReadability(data.accent)
      return { accent, contrast: contrastForHex(accent) }
    } catch {
      return null
    }
  }
}

const MIN_ACCENT_LIGHTNESS = 0.3
const MAX_ACCENT_LIGHTNESS = 0.7
const MIN_ACCENT_SATURATION = 0.3

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0)
      break
    case g:
      h = (b - r) / d + 2
      break
    default:
      h = (r - g) / d + 4
  }
  return [h / 6, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

// Averaging a whole cover can land on a color too close to either theme's
// page background to read as an accent at all -- a predominantly dark,
// moody cover (Piranesi's near-black jacket) averaged down to #211b18,
// practically invisible against the dark theme's own near-black
// background (confirmed live: unreadable chapter labels, picker text).
// Clamps lightness into a band that reads against both the near-black
// dark background and the near-white light one, and saturation away from
// a muddy, flat gray -- without touching hue, so the result still reads
// as "that cover's color," just usable as UI.
function clampAccentForReadability(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const [h, s, l] = rgbToHsl(r, g, b)
  const clampedL = Math.min(MAX_ACCENT_LIGHTNESS, Math.max(MIN_ACCENT_LIGHTNESS, l))
  const clampedS = Math.max(MIN_ACCENT_SATURATION, s)
  const [cr, cg, cb] = hslToRgb(h, clampedS, clampedL)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(cr)}${toHex(cg)}${toHex(cb)}`
}

// A readable text color for a given background hex, computed from the hex
// alone — used to theme a book's pages from its stored accent_color without
// re-fetching the cover image.
export function contrastForHex(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1a1a1a' : '#ffffff'
}
