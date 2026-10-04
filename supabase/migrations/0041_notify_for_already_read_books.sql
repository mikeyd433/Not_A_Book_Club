-- Lets a member opt into comment notifications for books they've already
-- read (finished, or read before joining), not just ones they're actively
-- reading/paused on -- stored as notification_prefs.notify_finished,
-- same JSONB column quiet hours already live in. Missing/false means "off"
-- (the long-standing default), so nobody starts getting new notifications
-- they didn't ask for.
--
-- se.muted stays an unconditional AND across both eligibility branches --
-- muting a specific book always wins over either global preference, exactly
-- as it already did for the reading/paused case.
create or replace function public.trg_enqueue_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_title text;
  v_group_id uuid;
begin
  select b.title, b.group_id into v_book_title, v_group_id
    from public.books b where b.id = new.book_id;

  insert into public.notification_outbox (user_id, book_id, title, body, url)
  select
    se.user_id,
    new.book_id,
    v_book_title,
    'New comment in the discussion',
    '/book/' || new.book_id || '/thread'
  from public.shelf_entries se
  join public.group_members gm
    on gm.user_id = se.user_id and gm.group_id = v_group_id
  where se.book_id = new.book_id
    and se.user_id <> new.user_id
    and not se.muted
    and (
      se.status in ('reading', 'paused')
      or (
        se.status in ('finished', 'read_before_joining')
        and coalesce((gm.notification_prefs->>'notify_finished')::boolean, false)
      )
    )
    and public.is_chapter_unlocked(se.user_id, new.book_id, new.chapter_id);

  return new;
end;
$$;
