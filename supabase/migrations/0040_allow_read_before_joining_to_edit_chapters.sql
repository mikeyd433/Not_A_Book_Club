-- Someone who read a book before the group started tracking it has full
-- thread access already (has_full_access()) but, until now, couldn't help
-- maintain its chapter list -- is_currently_reading() only allowed
-- 'reading'/'paused', which they've typically never been. They're often
-- the person best placed to fill in the real table of contents, so extend
-- the same chapters insert/update/delete RLS policies (which key off this
-- function) to cover 'read_before_joining' too. Name kept as-is even
-- though it's no longer strictly "currently reading" -- renaming would
-- mean recreating every policy that references it for a one-line
-- behavioral change.
create or replace function public.is_currently_reading(p_book_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shelf_entries
    where book_id = p_book_id
      and user_id = auth.uid()
      and status in ('reading', 'paused', 'read_before_joining')
  );
$$;
