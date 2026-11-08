-- This Supabase project is becoming the shared ("joined") database for every
-- app meant to be shared with other people, starting with NABC and Block
-- Party. The layout:
--
--   public       shared across apps: profiles (one account / one profile
--                per person, auto-provisioned by handle_new_user on signup)
--                and get_app_secret (Vault-backed secrets for Edge Functions).
--   nabc         everything specific to Not A Book Club (moved here by 0060).
--   block_party  everything specific to Block Party (empty for now).
--
-- Supabase Auth is per project, so putting apps in one project is what gives
-- people a single login across all of them. Each app's own tables still
-- decide (via RLS) what that person can see in that app.
--
-- This migration only creates the empty schemas so they can be added to the
-- Data API's "Exposed schemas" list (Dashboard -> Project Settings -> Data API)
-- *before* 0060 moves anything — PostgREST only serves schemas listed there.
-- It is safe to apply on its own: nothing reads from these schemas yet.
--
-- Grants and default privileges mirror what Supabase sets on public, so a
-- table/function created in an app schema later behaves like one created in
-- public did (RLS still has to be enabled per table, same as before).

do $$
declare
  s text;
begin
  foreach s in array array['nabc', 'block_party'] loop
    execute format('create schema if not exists %I', s);
    execute format('grant usage on schema %I to anon, authenticated, service_role', s);

    execute format('alter default privileges for role postgres in schema %I '
                   'grant all on tables to anon, authenticated, service_role', s);
    execute format('alter default privileges for role postgres in schema %I '
                   'grant all on sequences to anon, authenticated, service_role', s);
    execute format('alter default privileges for role postgres in schema %I '
                   'grant execute on functions to anon, authenticated, service_role', s);
  end loop;
end
$$;
