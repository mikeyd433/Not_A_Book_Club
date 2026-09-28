// Sends a Web Push notification to every subscription a user has on file.
// Called from Postgres (dispatch_notifications(), via pg_net) rather than
// from a browser session, so this is deployed with verify_jwt=false and
// checks a shared secret header instead -- see 0022_push_notifications.sql
// for why (nothing in the migration/deploy process here can set a
// standard edge function secret, so the secret lives in Supabase Vault and
// both sides read it via the get_app_secret() RPC).
//
// Web Push's VAPID signing + payload encryption (RFC 8291/8292) is
// intentionally not hand-rolled here -- that's exactly the kind of crypto
// that's easy to get subtly wrong and hard to notice, since a broken
// implementation still "succeeds" from Postgres's point of view (the HTTP
// call completes) while silently never producing a real notification. The
// `web-push` npm package is a known-correct, widely used implementation of
// both, imported via Deno's npm compatibility.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: expectedSecret, error: secretError } = await supabase.rpc(
    'get_app_secret',
    { p_name: 'dispatch_shared_secret' },
  )
  if (secretError || !expectedSecret) {
    return new Response('Server not configured', { status: 500 })
  }

  const providedSecret = req.headers.get('x-dispatch-secret')
  if (providedSecret !== expectedSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  let payloadIn: { user_id?: string; title?: string; body?: string; url?: string }
  try {
    payloadIn = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  const { user_id, title, body, url } = payloadIn
  if (!user_id || !title || !body) {
    return new Response('Missing required fields: user_id, title, body', { status: 400 })
  }

  const [{ data: vapidPublic }, { data: vapidPrivate }] = await Promise.all([
    supabase.rpc('get_app_secret', { p_name: 'vapid_public_key' }),
    supabase.rpc('get_app_secret', { p_name: 'vapid_private_key' }),
  ])
  if (!vapidPublic || !vapidPrivate) {
    return new Response('VAPID keys not configured', { status: 500 })
  }

  webpush.setVapidDetails('mailto:admin@dabingabongo.com', vapidPublic, vapidPrivate)

  const { data: subscriptions, error: subError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user_id)

  if (subError) {
    return new Response('Failed to load subscriptions', { status: 500 })
  }

  const payload = JSON.stringify({ title, body, url: url ?? '/' })

  const results = await Promise.allSettled(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
      } catch (err) {
        // Subscription no longer valid on the push service's end (browser
        // unsubscribed, uninstalled, etc.) -- clean it up so future
        // dispatches don't keep retrying a dead endpoint.
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
        throw err
      }
    }),
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.length - sent

  return new Response(JSON.stringify({ sent, failed, subscriptions: results.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
