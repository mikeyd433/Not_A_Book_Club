-- The Bulletin Board: general, group-wide discussion that isn't tied to
-- any one book. Same shape as comments (nested replies, flagging,
-- reactions, attachments) minus everything book/chapter/spoiler-specific
-- -- there's no lock rule here, so any group member sees any unflagged
-- post immediately. Flagging goes through SECURITY DEFINER RPCs rather
-- than a plain RLS UPDATE policy, same reasoning as flag_comment() in
-- 0014_flag_rpcs.sql: Postgres requires a row stay SELECT-visible to
-- whoever just wrote it, but flagging is specifically designed to remove
-- the flagger's own visibility.

create table public.group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete no action,
  parent_id uuid references public.group_posts (id) on delete cascade,
  body text not null,
  flagged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.group_posts enable row level security;

create policy "unflagged posts are readable by group members"
  on public.group_posts for select
  to authenticated
  using (
    public.is_group_member(group_id)
    and (
      user_id = auth.uid()
      or not flagged
      or public.is_group_admin(group_id)
    )
  );

create policy "members can post to their group"
  on public.group_posts for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.is_group_member(group_id)
  );

create policy "authors can delete their own posts"
  on public.group_posts for delete
  to authenticated
  using (user_id = auth.uid());

create policy "admins can delete flagged posts"
  on public.group_posts for delete
  to authenticated
  using (flagged and public.is_group_admin(group_id));

create index group_posts_group_idx on public.group_posts (group_id);
create index group_posts_parent_idx on public.group_posts (parent_id);

create function public.flag_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_flagged boolean;
begin
  select group_id, flagged into v_group_id, v_flagged
    from public.group_posts where id = p_post_id;

  if v_group_id is null then
    raise exception 'Post not found';
  end if;

  if v_flagged then
    return; -- already flagged, nothing to do
  end if;

  if not public.is_group_member(v_group_id) then
    raise exception 'Not a member of this group';
  end if;

  update public.group_posts set flagged = true where id = p_post_id;
end;
$$;

create function public.resolve_post_flag(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_author_id uuid;
  v_flagged boolean;
begin
  select group_id, user_id, flagged into v_group_id, v_author_id, v_flagged
    from public.group_posts where id = p_post_id;

  if v_group_id is null then
    raise exception 'Post not found';
  end if;

  if not v_flagged then
    raise exception 'This post isn''t flagged';
  end if;

  if v_author_id <> auth.uid() and not public.is_group_admin(v_group_id) then
    raise exception 'Only the poster or an admin can resolve a flag';
  end if;

  update public.group_posts set flagged = false where id = p_post_id;
end;
$$;

revoke execute on function public.flag_post(uuid) from anon;
revoke execute on function public.resolve_post_flag(uuid) from anon;

-- === reactions ================================================================

create table public.group_post_reactions (
  post_id uuid not null references public.group_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

alter table public.group_post_reactions enable row level security;

create policy "post reactions are readable when their post is"
  on public.group_post_reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.group_posts p
      where p.id = group_post_reactions.post_id
        and public.is_group_member(p.group_id)
        and (p.user_id = auth.uid() or not p.flagged or public.is_group_admin(p.group_id))
    )
  );

create policy "members can react to a post they can see"
  on public.group_post_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_posts p
      where p.id = group_post_reactions.post_id
        and public.is_group_member(p.group_id)
        and (p.user_id = auth.uid() or not p.flagged or public.is_group_admin(p.group_id))
    )
  );

create policy "members can remove their own post reaction"
  on public.group_post_reactions for delete
  to authenticated
  using (user_id = auth.uid());

create index group_post_reactions_post_idx on public.group_post_reactions (post_id);

-- === attachments ===============================================================

create table public.group_post_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.group_posts (id) on delete cascade,
  storage_path text,
  gif_url text,
  created_at timestamptz not null default now(),
  constraint group_post_attachments_exactly_one_kind
    check ((storage_path is not null) <> (gif_url is not null))
);

alter table public.group_post_attachments enable row level security;

create policy "post attachments are readable when their post is"
  on public.group_post_attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.group_posts p
      where p.id = group_post_attachments.post_id
        and public.is_group_member(p.group_id)
        and (p.user_id = auth.uid() or not p.flagged or public.is_group_admin(p.group_id))
    )
  );

create policy "post authors can add attachments to their own post"
  on public.group_post_attachments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.group_posts p
      where p.id = group_post_attachments.post_id and p.user_id = auth.uid()
    )
  );

create policy "authors can delete their own post attachments"
  on public.group_post_attachments for delete
  to authenticated
  using (
    exists (
      select 1 from public.group_posts p
      where p.id = group_post_attachments.post_id and p.user_id = auth.uid()
    )
  );

create index group_post_attachments_post_idx on public.group_post_attachments (post_id);

-- Private bucket, same reasoning as comment-attachments in 0025: flagging
-- hides the post row via RLS, which a public bucket URL would bypass
-- entirely, so this needs createSignedUrl() gated by the table policy
-- above rather than getPublicUrl().
insert into storage.buckets (id, name, public)
values ('bulletin-attachments', 'bulletin-attachments', false)
on conflict (id) do nothing;

create policy "bulletin attachment files follow the same visibility rule"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'bulletin-attachments'
    and exists (
      select 1 from public.group_post_attachments ga
      join public.group_posts p on p.id = ga.post_id
      where ga.storage_path = storage.objects.name
        and public.is_group_member(p.group_id)
        and (p.user_id = auth.uid() or not p.flagged or public.is_group_admin(p.group_id))
    )
  );

create policy "authenticated users can upload bulletin attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'bulletin-attachments' and owner = auth.uid());

create policy "uploaders can delete their own bulletin attachment files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'bulletin-attachments' and owner = auth.uid());

-- === notifications ==============================================================

-- Own opt-in (notification_prefs.notify_bulletin), separate from the
-- per-book reading/already-read toggles -- off by default, same reasoning
-- as notify_finished in 0041. Fires for replies too, same as the comment
-- trigger does for book discussion -- no separate "root post only" rule.
create function public.trg_enqueue_post_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_outbox (user_id, book_id, title, body, url)
  select
    gm.user_id,
    null,
    'Bulletin Board',
    'New post on the Bulletin Board',
    '/bulletin'
  from public.group_members gm
  where gm.group_id = new.group_id
    and gm.user_id <> new.user_id
    and coalesce((gm.notification_prefs->>'notify_bulletin')::boolean, false);

  return new;
end;
$$;

create trigger enqueue_post_notifications
  after insert on public.group_posts
  for each row execute function public.trg_enqueue_post_notifications();

revoke execute on function public.trg_enqueue_post_notifications() from public, anon, authenticated;

-- dispatch_notifications' batched message falls back to a book's title via
-- a left join, which is null for a bulletin notification's book_id --
-- "coalesce(..., 'a book')" would misreport those as being about an
-- unnamed book. 'the Bulletin Board' is accurate for both a lone bulletin
-- notification and a batch mixed with book ones.
create or replace function public.dispatch_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_edge_url text := 'https://dpflpwoivvpfvainzwgd.supabase.co/functions/v1/send-push';
  v_secret text;
  v_user record;
  v_count integer;
  v_books text;
  v_body text;
begin
  select public.get_app_secret('dispatch_shared_secret') into v_secret;
  if v_secret is null then
    return;
  end if;

  for v_user in
    select distinct no.user_id
    from public.notification_outbox no
    where no.sent_at is null
  loop
    if public.is_quiet_hours(v_user.user_id) then
      continue;
    end if;

    select count(*), string_agg(distinct coalesce(b.title, 'the Bulletin Board'), ', ')
      into v_count, v_books
      from public.notification_outbox no
      left join public.books b on b.id = no.book_id
      where no.user_id = v_user.user_id and no.sent_at is null;

    if coalesce(v_count, 0) = 0 then
      continue;
    end if;

    v_body := case
      when v_count = 1 then 'New comment in ' || v_books
      else v_count || ' new comments across ' || v_books
    end;

    perform net.http_post(
      url := v_edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', v_secret
      ),
      body := jsonb_build_object(
        'user_id', v_user.user_id,
        'title', 'Not A Book Club',
        'body', v_body,
        'url', '/'
      )
    );

    update public.notification_outbox
      set sent_at = now()
      where user_id = v_user.user_id and sent_at is null;
  end loop;
end;
$$;
