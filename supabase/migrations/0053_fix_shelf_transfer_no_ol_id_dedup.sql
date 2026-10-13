-- 0052's find_shelf_transfer_candidates could only detect "already
-- transferred" for a book with an open_library_id -- a manually-added
-- book (no open_library_id) had no way to match against one already
-- created in the destination group, so it would keep reappearing as a
-- candidate forever and, if applied again, create another duplicate copy
-- each time. Caught live: applying 'No OL Book' (no open_library_id) and
-- re-querying find_shelf_transfer_candidates immediately afterward still
-- listed it.
--
-- Fallback for the no-open_library_id case: treat a destination book with
-- the same title and author (both also lacking an open_library_id) as
-- already transferred. Not airtight -- a second, genuinely different book
-- that happens to share a title and no author could be suppressed -- but
-- it fixes the real bug (infinite re-offering of the same book) without
-- adding a schema column to track transfer provenance, and a false
-- suppression here just means re-adding that one book manually, same as
-- before this feature existed.
--
-- CREATE OR REPLACE rather than a new function -- the return columns are
-- unchanged, only the exclusion logic in the body, which Postgres does
-- allow replacing in place.
--
-- Verified live: re-querying find_shelf_transfer_candidates right after
-- applying 'No OL Book' now correctly returns zero rows (previously
-- returned it again); the open_library_id-based exclusion from 0052 is
-- unaffected (still correctly excludes those).

create or replace function public.find_shelf_transfer_candidates(p_group_id uuid)
returns table(
  old_book_id uuid,
  new_book_id uuid,
  title text,
  author text,
  old_status text,
  old_group_name text,
  old_current_chapter_id uuid,
  old_chapter_label text
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  return query
    select distinct on (coalesce(b_old.open_library_id, b_old.id::text))
      b_old.id, b_new.id, b_old.title, b_old.author, se_old.status, g_old.name,
      se_old.current_chapter_id, oc.label
    from public.shelf_entries se_old
    join public.books b_old on b_old.id = se_old.book_id
    join public.groups g_old on g_old.id = b_old.group_id
    left join public.books b_new
      on b_new.group_id = p_group_id
      and b_old.open_library_id is not null
      and b_new.open_library_id = b_old.open_library_id
    left join public.chapters oc on oc.id = se_old.current_chapter_id
    where se_old.user_id = auth.uid()
      and b_old.group_id <> p_group_id
      and not exists (
        select 1
        from public.shelf_entries se_existing
        join public.books b_existing on b_existing.id = se_existing.book_id
        where se_existing.user_id = auth.uid()
          and b_existing.group_id = p_group_id
          and (
            (b_old.open_library_id is not null and b_existing.open_library_id = b_old.open_library_id)
            or (
              b_old.open_library_id is null
              and b_existing.open_library_id is null
              and b_existing.title = b_old.title
              and coalesce(b_existing.author, '') = coalesce(b_old.author, '')
            )
          )
      )
    order by coalesce(b_old.open_library_id, b_old.id::text), se_old.updated_at desc;
end;
$$;

revoke execute on function public.find_shelf_transfer_candidates(uuid) from public, anon;
