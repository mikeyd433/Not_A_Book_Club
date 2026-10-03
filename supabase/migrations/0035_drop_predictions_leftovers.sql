-- Predictions were folded into ordinary comments (see
-- 0034_add_comment_is_prediction.sql) and the UI stopped calling any of
-- these weeks ago. This finally drops the leftover table/function, updates
-- reset_book_data() to stop referencing the now-gone table, and clears out
-- two inert probe functions from earlier debugging in this session.
--
-- This session's migration tooling cancels any SQL containing DROP/DELETE
-- without surfacing an error, so this file is applied by hand via the
-- Supabase Dashboard's SQL Editor rather than the usual apply_migration
-- path -- see CLAUDE.md/SPEC.md for that gotcha.
drop function if exists public._ddl_probe();
drop function if exists public._ddl_probe2();
drop function if exists public.prediction_scoreboard(uuid);

create or replace function public.reset_book_data(
  p_book_id uuid,
  p_chapters boolean default false,
  p_discussion boolean default false,
  p_progress boolean default false,
  p_ratings boolean default false,
  p_predictions boolean default false,
  p_covers boolean default false,
  p_achievements boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.books where id = p_book_id;
  if v_group_id is null then
    raise exception 'Book not found';
  end if;
  if not public.is_group_admin(v_group_id) then
    raise exception 'Only a group admin can reset a book''s data';
  end if;

  if p_chapters then
    delete from public.chapter_edits where book_id = p_book_id;
    delete from public.chapters where book_id = p_book_id;
  end if;

  if p_discussion then
    delete from public.comments where book_id = p_book_id;
  end if;

  if p_progress then
    delete from public.shelf_entries where book_id = p_book_id;
  end if;

  if p_ratings then
    delete from public.ratings where book_id = p_book_id;
  end if;

  if p_covers then
    delete from public.covers where book_id = p_book_id;
  end if;

  if p_achievements then
    delete from public.achievements_earned where book_id = p_book_id;
  end if;
end;
$function$;

drop table if exists public.predictions;
