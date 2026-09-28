-- 0020's shelf achievement trigger only checked "just became finished" (and
-- so the bookworm-at-5 threshold) inside the UPDATE branch, on the
-- assumption a shelf entry always starts elsewhere and transitions to
-- 'finished' later. But the real "Your shelf" UI lets a first-ever status
-- pick for a book be 'finished' directly (e.g. logging a book you already
-- read before this feature existed) -- an INSERT, not an UPDATE -- so a
-- reader who reached 5 finishes partly or wholly that way would never
-- trigger bookworm. Caught via a seeded-account test the same way as the
-- other RLS/trigger changes in this project: 4 books inserted pre-finished
-- (on top of one real update-to-finished) should have crossed the 5-finish
-- threshold and didn't.
create or replace function public.trg_award_shelf_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finished_count integer;
  v_just_finished boolean;
begin
  if tg_op = 'INSERT' then
    perform public.award_achievement(new.user_id, 'first_shelf', new.book_id);
  end if;

  v_just_finished := new.status = 'finished'
    and (tg_op = 'INSERT' or old.status is distinct from 'finished');

  if v_just_finished then
    perform public.award_achievement(new.user_id, 'first_finish', new.book_id);

    select count(*) into v_finished_count
      from public.shelf_entries
      where user_id = new.user_id and status = 'finished';
    if v_finished_count >= 5 then
      perform public.award_achievement(new.user_id, 'bookworm', new.book_id);
    end if;
  end if;

  if tg_op = 'UPDATE' and old.is_rereading and not new.is_rereading then
    perform public.award_achievement(new.user_id, 'first_reread', new.book_id);
  end if;

  return new;
end;
$$;
