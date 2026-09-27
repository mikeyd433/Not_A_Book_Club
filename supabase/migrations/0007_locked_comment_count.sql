-- RLS already fully hides locked comment rows (content included) from a
-- reader who hasn't reached their chapter. That's correct for content, but
-- the spec also wants a visible "N comments unlocked ahead" signal without
-- revealing anything about them -- which needs a count computed with
-- elevated privilege, since the reader's own session can't see those rows
-- at all to count them.

create function public.locked_comment_count(p_book_id uuid)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)
  from public.comments c
  where c.book_id = p_book_id
    and c.user_id <> auth.uid()
    and not public.is_chapter_unlocked(auth.uid(), c.book_id, c.chapter_id);
$$;
