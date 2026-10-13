-- Extends 0050's cross-group matching to also cover a book currently
-- being read (or paused) elsewhere, not just one already finished/DNF'd.
-- Status carries straight across (reading stays reading, paused stays
-- paused) rather than collapsing to read_before_joining, and the chapter
-- position comes with it: old_rank is the old book's current chapter's
-- 1-based position among its own chapters, and the new book's chapter at
-- that same rank (by its own position order) is what gets set there.
-- Chapter lists are entered independently per group, so this is a
-- same-ordinal-position heuristic, not a content match -- deliberately
-- the *lower* bound when it's wrong: if the new book has fewer chapters
-- than that rank, current_chapter_id is left null (nothing selected)
-- rather than clamped to its last chapter, which could overstate their
-- progress there and unlock content past what they've actually read.
--
-- New functions (find_cross_group_matches / apply_cross_group_matches)
-- rather than CREATE OR REPLACE on 0050's pair -- the return columns
-- changed (added old_book_id/old_current_chapter_id/old_chapter_label),
-- and Postgres doesn't allow REPLACE to change a function's return type;
-- it'd have to be DROP + CREATE instead, which this session's tooling
-- wouldn't run non-interactively (it treats DROP the same as DELETE).
-- 0050's find_cross_group_read_matches/apply_cross_group_read_matches
-- are superseded and no longer called from the client -- safe to drop in
-- a later migration whenever that gate isn't in the way.
--
-- Verified live with seeded throwaway groups/books/users before shipping:
-- a 'reading' match at rank 3 of 5 in the old book correctly maps to rank
-- 3 in a same-size new book; the same match against a 2-chapter new book
-- correctly leaves current_chapter_id null (rank 3 doesn't exist there);
-- against a 0-chapter new book, also null; a 'paused' match preserves
-- 'paused' (not read_before_joining) with the same rank mapping; the
-- pre-existing 'finished'/'read_before_joining'/'dnf' matches still work
-- exactly as before (regression-checked against 0050's own test cases).

create function public.find_cross_group_matches(p_group_id uuid)
returns table(
  new_book_id uuid,
  title text,
  author text,
  old_status text,
  old_group_name text,
  old_book_id uuid,
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
    select distinct on (b_new.id)
      b_new.id, b_new.title, b_new.author, se_old.status, g_old.name,
      b_old.id, se_old.current_chapter_id, oc.label
    from public.books b_new
    join public.books b_old
      on b_old.open_library_id = b_new.open_library_id
      and b_old.id <> b_new.id
    join public.shelf_entries se_old
      on se_old.book_id = b_old.id
      and se_old.user_id = auth.uid()
      and se_old.status in ('finished', 'read_before_joining', 'dnf', 'reading', 'paused')
    join public.groups g_old on g_old.id = b_old.group_id
    left join public.chapters oc on oc.id = se_old.current_chapter_id
    where b_new.group_id = p_group_id
      and b_new.open_library_id is not null
      and not exists (
        select 1 from public.shelf_entries se_new
        where se_new.book_id = b_new.id and se_new.user_id = auth.uid()
      )
    order by b_new.id, se_old.updated_at desc;
end;
$$;

revoke execute on function public.find_cross_group_matches(uuid) from public, anon;

create function public.apply_cross_group_matches(p_group_id uuid, p_book_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  insert into public.shelf_entries (book_id, user_id, status, current_chapter_id)
  with ranked_matches as (
    select
      m.new_book_id,
      m.old_status,
      m.old_book_id,
      m.old_current_chapter_id,
      (
        select count(*)
        from public.chapters oc
        join public.chapters cur on cur.id = m.old_current_chapter_id
        where oc.book_id = m.old_book_id and oc.position <= cur.position
      ) as old_rank
    from public.find_cross_group_matches(p_group_id) m
    where m.new_book_id = any(p_book_ids)
  )
  select
    rm.new_book_id,
    auth.uid(),
    case
      when rm.old_status in ('reading', 'paused') then rm.old_status
      when rm.old_status = 'dnf' then 'dnf'
      else 'read_before_joining'
    end,
    case
      when rm.old_status in ('reading', 'paused') and rm.old_current_chapter_id is not null then (
        select nc.id from public.chapters nc
        where nc.book_id = rm.new_book_id
        order by nc.position
        limit 1 offset greatest(rm.old_rank - 1, 0)
      )
      else null
    end
  from ranked_matches rm
  on conflict (user_id, book_id) do nothing;
end;
$$;

revoke execute on function public.apply_cross_group_matches(uuid, uuid[]) from public, anon;
