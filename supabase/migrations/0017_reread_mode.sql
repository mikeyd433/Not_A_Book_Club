-- Reread mode: "Start reread" keeps the original Finished status (and,
-- later, the original review) but wants locks to apply as if it's a first
-- read again, with spoil_me repurposed as an explicit "view full thread
-- anyway" opt-out. has_full_access previously treated status = 'finished'
-- as an unconditional grant, which would have made reread locking
-- impossible -- create or replace keeps the existing name/signature so
-- is_chapter_unlocked() and locked_comment_count(), which call it by name,
-- pick up the new behavior without any other migration.
create or replace function public.has_full_access(p_user_id uuid, p_book_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shelf_entries
    where user_id = p_user_id
      and book_id = p_book_id
      and (
        status = 'read_before_joining'
        or (status = 'finished' and (not is_rereading or spoil_me))
        or (status = 'dnf' and spoil_me)
      )
  );
$$;
