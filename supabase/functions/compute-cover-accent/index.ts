// Computes an average accent color from a cover image URL the browser
// can't read via canvas. Open Library's cover CDN doesn't set the
// Access-Control-Allow-Origin header getImageData() requires, so sampling
// it taints the canvas client-side no matter what crossOrigin is set to
// (confirmed live: accent_color stayed null for every Open-Library-sourced
// cover after the client-only fix shipped). A server-to-server fetch isn't
// subject to CORS at all, so this does the same sampling here instead --
// same reasoning send-push gives for not hand-rolling Web Push crypto:
// a client-side workaround for this would be exactly the kind of thing
// that silently never works and is hard to notice without a live device.
//
// Decodes JPEG bytes directly (jpeg-js, pure JS, no native deps -- Deno
// has neither a DOM Image nor a canvas to lean on here) rather than trying
// to recreate the browser's own image-loading pipeline. Scoped to Open
// Library URLs specifically; this isn't a general-purpose image proxy.
//
// Called straight from the browser like search-gifs, so this needs the
// same CORS preflight handling and per-call auth check (not send-push's
// shared-secret pattern, which is for Postgres-only calls).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import jpeg from 'npm:jpeg-js@0.4.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MAX_BYTES = 5 * 1024 * 1024

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  const jwt = authHeader?.replace('Bearer ', '')
  if (!jwt) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(jwt)
  if (userError || !user) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  let body: { imageUrl?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
  }

  const imageUrl = body.imageUrl
  if (!imageUrl || !imageUrl.startsWith('https://covers.openlibrary.org/')) {
    return new Response('Unsupported image URL', { status: 400, headers: corsHeaders })
  }

  let bytes: Uint8Array
  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error('fetch failed')
    const buf = await imgRes.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) throw new Error('too large')
    bytes = new Uint8Array(buf)
  } catch {
    return new Response('Could not load that image', { status: 502, headers: corsHeaders })
  }

  let decoded: { width: number; height: number; data: Uint8Array }
  try {
    decoded = jpeg.decode(bytes, { useTArray: true })
  } catch {
    return new Response('Could not decode that image', { status: 422, headers: corsHeaders })
  }

  // Same average-color approach as computeAccentColor in src/lib/image.ts,
  // just strided across at most ~1000 samples instead of a canvas-resize
  // downsample first (there's no canvas here to do that for free) -- same
  // "good enough, not perceptually exact" tradeoff that function already
  // makes.
  const { data, width, height } = decoded
  const totalPixels = width * height
  const step = Math.max(1, Math.floor(totalPixels / 1000))
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  for (let i = 0; i < totalPixels; i += step) {
    const offset = i * 4
    r += data[offset]
    g += data[offset + 1]
    b += data[offset + 2]
    count++
  }
  r = Math.round(r / count)
  g = Math.round(g / count)
  b = Math.round(b / count)

  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  const accent = `#${toHex(r)}${toHex(g)}${toHex(b)}`

  return new Response(JSON.stringify({ accent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
