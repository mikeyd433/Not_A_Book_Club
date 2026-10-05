-- Opt-in "admin activity feed" push notifications: lets a group admin get
-- pinged for other members' comments, bulletin posts, new books, and
-- chapter advances -- useful for watching a small beta group actually use
-- the app. Own toggle (notification_prefs.notify_admin_activity), same
-- JSONB column every other per-user notification preference lives in.
-- Deliberately not exposed to non-admins client-side (Settings.tsx gates
-- the checkbox on group.role === 'admin'), and enforced server-side too --
-- enqueue_admin_activity_notification() only ever inserts for group_members
-- rows with role = 'admin', so a non-admin flipping this on their own row
-- (nothing stops that at the RLS layer, same as any other notification_prefs
-- key) simply has no effect.
--
-- notification_outbox rows get a new `kind` column so dispatch_notifications
-- can tell these apart from comment notifications: comment rows stay
-- batched into one generic "N new comments across X" push per user, same as
-- before, but an admin watching activity wants to know *what* happened, so
-- admin_activity rows are each sent with their own specific message instead
-- of being folded into that count.

alter table public.notification_outbox
  add column kind text not null default 'comment'
  check (kind in ('comment', 'admin_activity'));

create function public.enqueue_admin_activity_notification(
  p_group_id uuid,
  p_actor_id uuid,
  p_book_id uuid,
  p_title text,
  p_body text,
  p_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_outbox (user_id, book_id, title, body, url, kind)
  select gm.user_id, p_book_id, p_title, p_body, p_url, 'admin_activity'
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.role = 'admin'
    and gm.user_id <> p_actor_id
    and coalesce((gm.notification_prefs->>'notify_admin_activity')::boolean, false);
end;
$$;

-- === book comments =============================================================

create function public.trg_notify_admins_comment_posted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_book_title text;
  v_display_name text;
begin
  select b.group_id, b.title into v_group_id, v_book_title
    from public.books b where b.id = new.book_id;
  select display_name into v_display_name from public.profiles where id = new.user_id;

  perform public.enqueue_admin_activity_notification(
    v_group_id,
    new.user_id,
    new.book_id,
    '🔎 Admin activity',
    coalesce(v_display_name, 'Someone') || ' commented on ' || coalesce(v_book_title, 'a book'),
    '/book/' || new.book_id || '/thread'
  );
  return new;
end;
$$;

create trigger notify_admins_comment_posted
  after insert on public.comments
  for each row execute function public.trg_notify_admins_comment_posted();

-- === bulletin posts =============================================================

create function public.trg_notify_admins_bulletin_posted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  select display_name into v_display_name from public.profiles where id = new.user_id;

  perform public.enqueue_admin_activity_notification(
    new.group_id,
    new.user_id,
    null,
    '🔎 Admin activity',
    coalesce(v_display_name, 'Someone') || ' posted on the Bulletin Board',
    '/bulletin'
  );
  return new;
end;
$$;

create trigger notify_admins_bulletin_posted
  after insert on public.group_posts
  for each row execute function public.trg_notify_admins_bulletin_posted();

-- === new books ===================================================================

create function public.trg_notify_admins_book_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  select display_name into v_display_name from public.profiles where id = new.added_by;

  perform public.enqueue_admin_activity_notification(
    new.group_id,
    new.added_by,
    new.id,
    '🔎 Admin activity',
    coalesce(v_display_name, 'Someone') || ' added "' || new.title || '"',
    '/book/' || new.id
  );
  return new;
end;
$$;

create trigger notify_admins_book_added
  after insert on public.books
  for each row execute function public.trg_notify_admins_book_added();

-- === chapter advances ============================================================

create function public.trg_notify_admins_chapter_advanced()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_book_title text;
  v_display_name text;
  v_chapter_label text;
begin
  if new.current_chapter_id is distinct from old.current_chapter_id
     and new.current_chapter_id is not null then
    select b.group_id, b.title into v_group_id, v_book_title
      from public.books b where b.id = new.book_id;
    select display_name into v_display_name from public.profiles where id = new.user_id;
    select label into v_chapter_label from public.chapters where id = new.current_chapter_id;

    perform public.enqueue_admin_activity_notification(
      v_group_id,
      new.user_id,
      new.book_id,
      '🔎 Admin activity',
      coalesce(v_display_name, 'Someone') || ' advanced to ' ||
        coalesce(v_chapter_label, 'a new chapter') || ' in ' || coalesce(v_book_title, 'a book'),
      '/book/' || new.book_id
    );
  end if;
  return new;
end;
$$;

create trigger notify_admins_chapter_advanced
  after update on public.shelf_entries
  for each row execute function public.trg_notify_admins_chapter_advanced();

-- === dispatch =====================================================================

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
  v_activity record;
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
      where no.user_id = v_user.user_id and no.sent_at is null and no.kind = 'comment';

    if coalesce(v_count, 0) > 0 then
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
        where user_id = v_user.user_id and sent_at is null and kind = 'comment';
    end if;

    -- Each admin_activity row is its own push with its own message, not
    -- batched -- a generic "3 updates" count would defeat the point of a
    -- feed meant to show exactly what happened.
    for v_activity in
      select id, title, body, url
      from public.notification_outbox
      where user_id = v_user.user_id and sent_at is null and kind = 'admin_activity'
      order by created_at
    loop
      perform net.http_post(
        url := v_edge_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-dispatch-secret', v_secret
        ),
        body := jsonb_build_object(
          'user_id', v_user.user_id,
          'title', v_activity.title,
          'body', v_activity.body,
          'url', coalesce(v_activity.url, '/')
        )
      );

      update public.notification_outbox
        set sent_at = now()
        where id = v_activity.id;
    end loop;
  end loop;
end;
$$;

revoke execute on function public.enqueue_admin_activity_notification(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.trg_notify_admins_comment_posted() from public, anon, authenticated;
revoke execute on function public.trg_notify_admins_bulletin_posted() from public, anon, authenticated;
revoke execute on function public.trg_notify_admins_book_added() from public, anon, authenticated;
revoke execute on function public.trg_notify_admins_chapter_advanced() from public, anon, authenticated;
