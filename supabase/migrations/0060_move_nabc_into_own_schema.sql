-- Move every NABC-specific table and function out of public and into the
-- nabc schema (created by 0059), leaving public for things shared by every
-- app in this project: profiles, handle_new_user (the signup trigger that
-- provisions a profile) and get_app_secret.
--
-- PREREQUISITE: "nabc" must already be in the Data API's Exposed schemas
-- (Dashboard -> Project Settings -> Data API), and the frontend/Edge
-- Functions that talk to the nabc schema must ship right after this is
-- applied — the old frontend asks PostgREST for public.books etc., which
-- stop existing here. Expect a few minutes of downtime between the two.
--
-- What moves cleanly on its own: ALTER ... SET SCHEMA keeps each object's
-- OID, so everything that references objects by OID follows automatically
-- — foreign keys (including nabc.* -> public.profiles), indexes, RLS
-- policies, triggers, column defaults, grants, the storage.objects
-- policies that read comment_attachments/group_posts, and owned sequences.
--
-- What doesn't: function *bodies* are stored as text, and most of them say
-- public.books, public.is_group_admin(...) etc. explicitly (plus
-- `set search_path = public`). So after moving each function we re-create
-- it from pg_get_functiondef with public.<x> rewritten to nabc.<x> (except
-- the objects that stay shared in public) and search_path set to
-- nabc, public. CREATE OR REPLACE keeps the OID, so triggers, policies and
-- grants that point at the function are untouched.
--
-- Finally, nabc.profiles is a security_invoker view over public.profiles,
-- so the app — whose client is pinned to the nabc schema — can still read
-- and update profiles and keep PostgREST embeds like
-- comments.select('*, profiles(display_name)') working (PostgREST resolves
-- the view back to the base table's foreign keys). security_invoker means
-- public.profiles' own RLS policies apply exactly as before. It's a
-- `select *` view, so if a column is ever added to public.profiles,
-- re-create the view to pick it up.

-- ---------------------------------------------------------------------------
-- 1. Tables (FK order doesn't matter for SET SCHEMA)
-- ---------------------------------------------------------------------------
alter table public.groups                 set schema nabc;
alter table public.group_members          set schema nabc;
alter table public.books                  set schema nabc;
alter table public.covers                 set schema nabc;
alter table public.chapters               set schema nabc;
alter table public.chapter_edits          set schema nabc;
alter table public.shelf_entries          set schema nabc;
alter table public.comments               set schema nabc;
alter table public.reactions              set schema nabc;
alter table public.spoiler_blocks         set schema nabc;
alter table public.predictions            set schema nabc;
alter table public.ratings                set schema nabc;
alter table public.achievements           set schema nabc;
alter table public.achievements_earned    set schema nabc;
alter table public.push_subscriptions     set schema nabc;
alter table public.notification_outbox    set schema nabc;
alter table public.comment_attachments    set schema nabc;
alter table public.group_posts            set schema nabc;
alter table public.group_post_reactions   set schema nabc;
alter table public.group_post_attachments set schema nabc;

-- ---------------------------------------------------------------------------
-- 2. Functions: move, then rewrite their bodies to point at nabc
-- ---------------------------------------------------------------------------
do $$
declare
  r   record;
  def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      -- stay shared in public:
      and p.proname not in ('handle_new_user', 'get_app_secret')
      -- leftover scratch functions from an old migration session; not NABC's
      and p.proname not like '\_ddl\_probe%'
  loop
    execute format('alter function %s set schema nabc', r.oid::regprocedure);
  end loop;

  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'nabc' and p.prokind = 'f'
  loop
    def := pg_get_functiondef(r.oid);
    -- public.<anything but the shared objects> -> nabc.<same>
    def := regexp_replace(def, '\mpublic\.(?!(profiles|get_app_secret)\M)', 'nabc.', 'g');
    -- `SET search_path TO 'public'` (and 'public', 'extensions')
    def := replace(def, 'SET search_path TO ''public''', 'SET search_path TO ''nabc'', ''public''');
    execute def;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. pg_cron job that drains the push-notification outbox
-- ---------------------------------------------------------------------------
select cron.alter_job(
  job_id  := (select jobid from cron.job where jobname = 'dispatch-notifications'),
  command := 'select nabc.dispatch_notifications();'
);

-- ---------------------------------------------------------------------------
-- 4. nabc.profiles: the app's window onto the shared profiles table
-- ---------------------------------------------------------------------------
create view nabc.profiles
  with (security_invoker = true)
  as select * from public.profiles;

grant select, insert, update, delete on nabc.profiles to anon, authenticated, service_role;
