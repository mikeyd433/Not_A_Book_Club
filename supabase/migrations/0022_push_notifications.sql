-- Push notifications: per-book mute (shelf_entries.muted, already existed
-- but was never wired to anything -- see BookDetail.tsx) and quiet hours
-- with batching (notifications during quiet hours aren't dropped, just
-- left unsent until a later dispatch run after quiet hours end).
--
-- Pipeline: an AFTER INSERT trigger on comments enqueues one
-- notification_outbox row per eligible recipient -> a pg_cron job runs
-- dispatch_notifications() every 5 minutes, which skips any user currently
-- in quiet hours (their rows stay unsent for the next run) and otherwise
-- batches that user's pending rows into one push, calls the send-push edge
-- function via pg_net, and marks them sent. VAPID keys and a shared secret
-- (the edge function is deployed with verify_jwt=false, since pg_net is
-- calling it, not a user session) live in Supabase Vault, read via
-- get_app_secret() -- not a Postgres/Netlify env var, since nothing in this
-- migration process can set edge function secrets directly.
--
-- Known limitation: dispatch marks a user's rows sent immediately after
-- firing the (async, fire-and-forget) pg_net request, without checking the
-- HTTP response. If the edge function is down, that batch is lost rather
-- than retried. Acceptable for a small private friend group; revisit with
-- a response-checking follow-up pass if it matters in practice.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "users manage their own push subscriptions"
  on public.push_subscriptions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Internal queue, same "no policies at all" pattern as achievements_earned:
-- unreachable directly via PostgREST, written only by the trigger below and
-- read/updated only by dispatch_notifications().
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  book_id uuid references public.books (id) on delete cascade,
  title text not null,
  body text not null,
  url text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

alter table public.notification_outbox enable row level security;

-- Server-side secret store. group_members.notification_prefs shape:
-- {"quiet_start": "22:00", "quiet_end": "07:00", "timezone": "America/New_York"}
-- Missing/malformed prefs mean "no quiet hours" rather than blocking
-- notifications entirely.
create function public.get_app_secret(p_name text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name;
$$;

create function public.is_quiet_hours(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefs jsonb;
  v_tz text;
  v_start time;
  v_end time;
  v_local_time time;
begin
  select gm.notification_prefs into v_prefs
    from public.group_members gm
    where gm.user_id = p_user_id
    limit 1;

  if v_prefs is null or v_prefs->>'quiet_start' is null or v_prefs->>'quiet_end' is null then
    return false;
  end if;

  begin
    v_tz := coalesce(v_prefs->>'timezone', 'UTC');
    v_start := (v_prefs->>'quiet_start')::time;
    v_end := (v_prefs->>'quiet_end')::time;
    v_local_time := (now() at time zone v_tz)::time;
  exception when others then
    return false;
  end;

  if v_start <= v_end then
    return v_local_time >= v_start and v_local_time < v_end;
  else
    -- wraps past midnight, e.g. 22:00 -> 07:00
    return v_local_time >= v_start or v_local_time < v_end;
  end if;
end;
$$;

-- Only notify someone who can actually see the comment right now
-- (is_chapter_unlocked) -- a "new activity" push for content they haven't
-- unlocked yet would itself be a spoiler signal. Only readers currently
-- "reading"/"paused" that book, who haven't muted it.
create function public.trg_enqueue_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_title text;
begin
  select b.title into v_book_title from public.books b where b.id = new.book_id;

  insert into public.notification_outbox (user_id, book_id, title, body, url)
  select
    se.user_id,
    new.book_id,
    v_book_title,
    'New comment in the discussion',
    '/book/' || new.book_id || '/thread'
  from public.shelf_entries se
  where se.book_id = new.book_id
    and se.user_id <> new.user_id
    and se.status in ('reading', 'paused')
    and not se.muted
    and public.is_chapter_unlocked(se.user_id, new.book_id, new.chapter_id);

  return new;
end;
$$;

create trigger enqueue_comment_notifications
  after insert on public.comments
  for each row execute function public.trg_enqueue_comment_notifications();

create function public.dispatch_notifications()
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

    select count(*), string_agg(distinct coalesce(b.title, 'a book'), ', ')
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

select cron.schedule('dispatch-notifications', '*/5 * * * *', 'select public.dispatch_notifications();');

revoke execute on function public.get_app_secret(text) from public, anon, authenticated;
revoke execute on function public.is_quiet_hours(uuid) from public, anon, authenticated;
revoke execute on function public.trg_enqueue_comment_notifications() from public, anon, authenticated;
revoke execute on function public.dispatch_notifications() from public, anon, authenticated;
