-- The advisor flags every SECURITY DEFINER function as callable via
-- PostgREST RPC (that's true of anything in the public schema by default).
-- Most of these are meant to be called that way (create_group,
-- join_group_by_code, set_default_cover, the is_*/has_* predicate checks,
-- which only ever read the caller's own access). The three trigger-only
-- functions are not: calling them directly makes no sense (they read NEW/
-- OLD) and don't need to be reachable from the API surface at all.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_first_cover_as_default() from public, anon, authenticated;
revoke execute on function public.guard_default_cover_change() from public, anon, authenticated;

-- Missing search_path made this callable in a way that could resolve
-- `upper`/`replace`/etc from a caller-controlled search_path.
create or replace function public.generate_invite_code()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select upper(substr(replace(encode(gen_random_bytes(6), 'base64'), '/', 'x'), 1, 8));
$$;
