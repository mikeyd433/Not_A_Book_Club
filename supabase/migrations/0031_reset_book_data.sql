-- Admin-only: wipe selected categories of a book's data without deleting
-- the book itself (title/author/cover stay put) -- e.g. to start a group
-- reread from a clean slate, or undo test/junk data, without losing the
-- book record and having to re-add it.
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
as $$
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

  -- Chapters cascade-delete comments/reactions/spoiler_blocks/
  -- comment_attachments/predictions tied to them, and null out everyone's
  -- current_chapter_id -- so resetting chapters always wipes discussion
  -- and predictions with it, whether or not those were separately
  -- requested. chapter_edits isn't covered by that cascade (it only
  -- cascades from the book itself, not from individual chapters), so it's
  -- cleared explicitly here -- a revert history pointing at a chapter list
  -- that no longer exists would just be confusing, not useful.
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

  if p_predictions then
    delete from public.predictions where book_id = p_book_id;
  end if;

  if p_covers then
    delete from public.covers where book_id = p_book_id;
  end if;

  if p_achievements then
    delete from public.achievements_earned where book_id = p_book_id;
  end if;
end;
$$;

-- New functions get anon EXECUTE granted directly at creation time
-- (Supabase's default privileges rule for the public schema), separate
-- from the PUBLIC-pseudo-role mechanism -- so this revokes from both anon
-- and public to close whichever one actually applies (same pattern as
-- migration 0030's regenerate_invite_code).
revoke execute on function public.reset_book_data(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) from public, anon;
grant execute on function public.reset_book_data(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to authenticated;
