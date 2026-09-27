-- Profiles, groups, membership, and the RLS helper functions everything
-- else in this schema builds on.

create extension if not exists pgcrypto;

-- === profiles ===============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any authenticated user can read any profile (small private friend group;
-- names/avatars aren't sensitive and are needed everywhere: comment authors,
-- shelf lists, achievement feed, etc).
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- New auth.users row -> auto-provision a profile, so the client never has to
-- do a separate "create my profile" step after magic-link signup.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- === groups ==================================================================

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  notification_prefs jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- SECURITY DEFINER helpers so policies on group_members don't recurse into
-- themselves (a policy on group_members that queries group_members directly
-- triggers RLS again on the same table).
create function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

create function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and role = 'admin'
  );
$$;

create policy "members can read their group"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

create policy "members can read their own membership rows"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "admins can update member roles"
  on public.group_members for update
  to authenticated
  using (public.is_group_admin(group_id));

create function public.generate_invite_code()
returns text
language sql
volatile
as $$
  select upper(substr(replace(encode(gen_random_bytes(6), 'base64'), '/', 'x'), 1, 8));
$$;

-- Group creation and joining go through RPCs rather than direct inserts:
-- a brand-new user has no membership row yet, so plain insert policies on
-- groups/group_members can't tell "creating my first group" apart from
-- anyone else creating rows.
create function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups;
begin
  insert into public.groups (name, invite_code, created_by)
  values (p_name, public.generate_invite_code(), auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'admin');

  return v_group;
end;
$$;

create function public.join_group_by_code(p_invite_code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups;
begin
  select * into v_group from public.groups where invite_code = upper(p_invite_code);

  if v_group.id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group;
end;
$$;
