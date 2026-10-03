// Lets a group admin create and delete disposable, email-less test
// members for trying out features that depend on being someone else (per-
// chapter comment reveal, chapter-unlock position, etc.) without needing a
// second real email address. See src/lib/testAccounts.ts for the client
// side of this -- it swaps the browser's actual Supabase session to the
// returned one, so testing reflects real RLS/auth.uid() behavior.
//
// Two things this can never do, enforced server-side, not just in the UI:
// - create/delete only act on the caller's OWN group (resolved from their
//   own group_members row, never a client-supplied group id)
// - delete refuses outright unless the target profile has
//   is_test_account = true, so this endpoint can't become a general
//   "remove any member" tool even if someone finds the request shape.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

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
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey)

  const {
    data: { user: caller },
    error: callerError,
  } = await admin.auth.getUser(jwt)
  if (callerError || !caller) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders })
  }

  const { data: callerMembership, error: membershipError } = await admin
    .from('group_members')
    .select('group_id')
    .eq('user_id', caller.id)
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()
  if (membershipError) {
    return new Response('Failed to resolve group', { status: 500, headers: corsHeaders })
  }
  if (!callerMembership) {
    return new Response('Only a group admin can manage test accounts', {
      status: 403,
      headers: corsHeaders,
    })
  }
  const groupId = callerMembership.group_id

  let body: { action?: string; label?: string; userId?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders })
  }

  if (body.action === 'create') {
    const label = (body.label ?? '').trim().slice(0, 60) || 'Test account'

    // A plain anon-key client, not the service-role one above -- anonymous
    // sign-in is a normal (unprivileged) auth operation, and keeping it on
    // a throwaway client avoids this response ever accidentally carrying
    // the service-role session instead of the new anonymous one.
    const anon = createClient(supabaseUrl, anonKey)
    const { data: signUp, error: signUpError } = await anon.auth.signInAnonymously({
      options: { data: { display_name: label } },
    })
    if (signUpError || !signUp.user || !signUp.session) {
      return new Response(
        `Failed to create the test account: ${signUpError?.message ?? 'unknown error'}. ` +
          `If this is the first attempt, check that Anonymous Sign-Ins are enabled in ` +
          `the Supabase Dashboard under Authentication -> Sign In Methods.`,
        { status: 502, headers: corsHeaders },
      )
    }

    const { error: memberError } = await admin
      .from('group_members')
      .insert({ group_id: groupId, user_id: signUp.user.id, role: 'member' })
    if (memberError) {
      return new Response('Failed to add the test account to your group', {
        status: 500,
        headers: corsHeaders,
      })
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({ is_test_account: true, display_name: label })
      .eq('id', signUp.user.id)
    if (profileError) {
      return new Response('Failed to tag the test account', {
        status: 500,
        headers: corsHeaders,
      })
    }

    return new Response(
      JSON.stringify({
        userId: signUp.user.id,
        label,
        access_token: signUp.session.access_token,
        refresh_token: signUp.session.refresh_token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (body.action === 'delete') {
    const userId = body.userId
    if (!userId) {
      return new Response('Missing userId', { status: 400, headers: corsHeaders })
    }

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('is_test_account')
      .eq('id', userId)
      .maybeSingle()
    if (targetError || !target || !target.is_test_account) {
      return new Response('That account is not a deletable test account', {
        status: 403,
        headers: corsHeaders,
      })
    }

    const { data: targetMembership } = await admin
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .maybeSingle()
    if (!targetMembership) {
      return new Response('That test account is not in your group', {
        status: 403,
        headers: corsHeaders,
      })
    }

    // comments.user_id and chapter_edits.user_id are ON DELETE NO ACTION
    // (deliberately -- see 0034/0035's notes), so deleting the auth user
    // first would just fail with a foreign key violation. Clear those (and
    // the one other NO ACTION reference a test account could plausibly
    // hold) before handing off to the Admin API, which cascades the rest
    // (group_members, shelf_entries, reactions, ratings, etc.) itself.
    await admin.from('comments').delete().eq('user_id', userId)
    await admin.from('chapter_edits').delete().eq('user_id', userId)
    await admin.from('books').update({ added_by: null }).eq('added_by', userId)

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) {
      return new Response(`Failed to delete the account: ${deleteError.message}`, {
        status: 500,
        headers: corsHeaders,
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response('Unknown action', { status: 400, headers: corsHeaders })
})
