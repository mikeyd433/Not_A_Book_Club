-- Broadens the join-time picker from "only books that already exist in
-- both groups" to the caller's whole shelf across every other group they
-- belong to. A candidate whose book doesn't exist in the destination
-- group yet (new_book_id is null) gets created there on apply, copying
-- its title/author/open_library_id/open_library_cover_url and its full
-- chapter list (in order) -- not just a custom cover image, which lives
-- in Storage, not a row this SQL function can duplicate; the new book
-- falls back to its Open Library cover same as any other book without a
-- custom one. Copying the whole chapter list (not just up to the current
-- one) keeps it consistent with find_chapter_layouts/copy_chapter_layout
-- (0046), and means a freshly-created book always has exactly as many
-- chapters as its source, so the chapter-rank carryover below never hits
-- 0051's "new book has fewer chapters" case for these -- only a
-- *pre-existing* match in the destination group can still have a
-- different chapter count than the source.
--
-- status carries straight across for reading/paused/want_to_read/dnf;
-- finished and read_before_joining both collapse to read_before_joining,
-- same reasoning as 0050/0051 (there's no "finished the whole book"
-- tracking to replicate, but read_before_joining grants the same full
-- access).
--
-- New functions (find_shelf_transfer_candidates / apply_shelf_transfer)
-- rather than altering 0051's pair -- same reason as 0051 vs 0050: the
-- return/selection shape changed (selecting by old_book_id now, since a
-- not-yet-existing book has no new_book_id to select by), and this
-- session's tooling won't run the DROP + CREATE a return-type change
-- would need non-interactively. 0050/0051's four functions are all
-- superseded now and no longer called from the client.
--
-- Verified live with seeded throwaway groups/books/users before shipping:
-- find_shelf_transfer_candidates lists every shelf entry across other
-- groups (every status, including want_to_read and ones with no
-- open_library_id) except a book already shelved in the destination
-- group, and correctly reports new_book_id as null for one that doesn't
-- exist there yet; apply_shelf_transfer on an unmatched 'reading' book at
-- rank 2 of 3 creates the book and all 3 chapters in the destination
-- group and sets current_chapter_id to the newly-copied chapter at rank
-- 2 there; on an unmatched 'want_to_read' book it creates the book with
-- no chapters needed and status want_to_read; a 'dnf' book keeps 'dnf';
-- a 'finished' book becomes 'read_before_joining'; re-running the find
-- after applying no longer lists the ones just added; the group-
-- membership guard rejects a caller who isn't in the destination group.

create function public.find_shelf_transfer_candidates(p_group_id uuid)
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
          and b_old.open_library_id is not null
          and b_existing.open_library_id = b_old.open_library_id
      )
    order by coalesce(b_old.open_library_id, b_old.id::text), se_old.updated_at desc;
end;
$$;

revoke execute on function public.find_shelf_transfer_candidates(uuid) from public, anon;

create function public.apply_shelf_transfer(p_group_id uuid, p_old_book_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_new_book_id uuid;
  v_old_rank int;
  v_new_current_chapter_id uuid;
  v_new_status text;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  for rec in
    select *
    from public.find_shelf_transfer_candidates(p_group_id) c
    where c.old_book_id = any(p_old_book_ids)
  loop
    v_new_book_id := rec.new_book_id;

    if v_new_book_id is null then
      insert into public.books (group_id, title, author, open_library_id, open_library_cover_url, added_by)
      select p_group_id, b.title, b.author, b.open_library_id, b.open_library_cover_url, auth.uid()
      from public.books b
      where b.id = rec.old_book_id
      returning id into v_new_book_id;

      insert into public.chapters (book_id, position, label, part_label)
      select v_new_book_id, c.position, c.label, c.part_label
      from public.chapters c
      where c.book_id = rec.old_book_id
      order by c.position;
    end if;

    v_new_current_chapter_id := null;
    if rec.old_status in ('reading', 'paused') and rec.old_current_chapter_id is not null then
      select count(*) into v_old_rank
      from public.chapters oc
      join public.chapters cur on cur.id = rec.old_current_chapter_id
      where oc.book_id = rec.old_book_id and oc.position <= cur.position;

      select nc.id into v_new_current_chapter_id
      from public.chapters nc
      where nc.book_id = v_new_book_id
      order by nc.position
      limit 1 offset greatest(v_old_rank - 1, 0);
    end if;

    v_new_status := case
      when rec.old_status in ('reading', 'paused', 'want_to_read', 'dnf') then rec.old_status
      else 'read_before_joining'
    end;

    insert into public.shelf_entries (book_id, user_id, status, current_chapter_id)
    values (v_new_book_id, auth.uid(), v_new_status, v_new_current_chapter_id)
    on conflict (user_id, book_id) do nothing;
  end loop;
end;
$$;

revoke execute on function public.apply_shelf_transfer(uuid, uuid[]) from public, anon;
