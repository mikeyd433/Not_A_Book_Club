// Proxies Giphy search so the API key never reaches the client (the
// original "Suggested Stack" spec called this out explicitly). Unlike
// send-push, this IS called directly from a browser session, so it keeps
// the default verify_jwt=true rather than a shared-secret header -- but
// verify_jwt only checks the JWT is validly signed by the project, which
// is also true of the bare anon key (itself a JWT). To require an actual
// signed-in group member rather than "anyone with the public anon key",
// this additionally resolves the JWT to a real user via auth.getUser().
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Called straight from the browser (dabingabongo.com -> *.supabase.co is
// cross-origin), so the browser preflights every call with an OPTIONS
// request first. Without an explicit 200 + CORS headers for that preflight,
// the browser never sends the real POST at all -- the request just vanishes
// client-side with no network error PostgREST/supabase-js can surface,
// exactly like a hung search. send-push, by contrast, is only ever called
// from Postgres via pg_net, never a browser, so it never needed this.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

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

  let body: { q?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
  }

  const q = (body.q ?? '').trim().slice(0, 100)
  if (!q) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: apiKey, error: keyError } = await supabase.rpc('get_app_secret', {
    p_name: 'giphy_api_key',
  })
  if (keyError || !apiKey) {
    return new Response('GIF search is not configured', { status: 500, headers: corsHeaders })
  }

  const giphyUrl = new URL('https://api.giphy.com/v1/gifs/search')
  giphyUrl.searchParams.set('api_key', apiKey)
  giphyUrl.searchParams.set('q', q)
  giphyUrl.searchParams.set('limit', '24')
  giphyUrl.searchParams.set('rating', 'pg-13')

  const giphyRes = await fetch(giphyUrl)
  if (!giphyRes.ok) {
    return new Response('GIF search failed', { status: 502, headers: corsHeaders })
  }

  const giphyData = await giphyRes.json()
  const results = (giphyData.data ?? []).map((g: {
    id: string
    images: {
      fixed_width_small: { url: string }
      original: { url: string }
    }
  }) => ({
    id: g.id,
    previewUrl: g.images.fixed_width_small.url,
    fullUrl: g.images.original.url,
  }))

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
