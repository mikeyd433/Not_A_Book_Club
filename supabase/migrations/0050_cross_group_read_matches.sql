-- Lets someone who already marked a book finished/read-before-joining/DNF
-- in one group skip re-reading it from scratch after joining a second
-- group that happens to have the same book -- matched by open_library_id,
-- the same reliable cross-group identifier 0046's chapter-layout reuse
-- uses (manually-added books have none and are out of scope here). Shown
-- as a checkbox picker right after joining (JoinOrCreateGroup.tsx) rather
-- than applied automatically, so a DNF'd book doesn't silently unlock as
-- fully spoiled without the person choosing that themselves.
--
-- Both RPCs are SECURITY DEFINER for the same reason as 0046's pair: a
-- caller has no RLS access to another group's books once they've left it,
-- even though the shelf_entries row being matched against is their own.
-- Unlike 0046, there's no cross-group leakage risk to guard against here
-- -- every row read is either the new group (is_group_member re-checked
-- explicitly, same as find_chapter_layouts) or the caller's own shelf
-- history, which they already know. apply_cross_group_read_matches
-- re-derives the legitimate match set itself (via
-- find_cross_group_read_matches) rather than trusting client-supplied
-- statuses, so a crafted call can't backdate an arbitrary book to
-- "already read" without a real matching shelf entry behind it.
--
-- Verified live with seeded throwaway groups/books/users before shipping:
-- find_cross_group_read_matches correctly surfaces a same-open_library_id
-- finished/read_before_joining/dnf match from another group, excludes a
-- book already on the new group's shelf, excludes a non-matching
-- open_library_id, and excludes books with no open_library_id at all;
-- apply_cross_group_read_matches correctly inserts read_before_joining
-- for a finished/read_before_joining match and dnf for a dnf match, is a
-- no-op for a book_id not in the real match set, and rejects a caller
-- who isn't a member of the destination group.

create function public.find_cross_group_read_matches(p_group_id uuid)
returns table(new_book_id uuid, title text, author text, old_status text, old_group_name text)
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
      b_new.id, b_new.title, b_new.author, se_old.status, g_old.name
    from public.books b_new
    join public.books b_old
      on b_old.open_library_id = b_new.open_library_id
      and b_old.id <> b_new.id
    join public.shelf_entries se_old
      on se_old.book_id = b_old.id
      and se_old.user_id = auth.uid()
      and se_old.status in ('finished', 'read_before_joining', 'dnf')
    join public.groups g_old on g_old.id = b_old.group_id
    where b_new.group_id = p_group_id
      and b_new.open_library_id is not null
      and not exists (
        select 1 from public.shelf_entries se_new
        where se_new.book_id = b_new.id and se_new.user_id = auth.uid()
      )
    order by b_new.id, se_old.updated_at desc;
end;
$$;

revoke execute on function public.find_cross_group_read_matches(uuid) from public, anon;

create function public.apply_cross_group_read_matches(p_group_id uuid, p_book_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  insert into public.shelf_entries (book_id, user_id, status)
  select
    m.new_book_id,
    auth.uid(),
    case m.old_status when 'dnf' then 'dnf' else 'read_before_joining' end
  from public.find_cross_group_read_matches(p_group_id) m
  where m.new_book_id = any(p_book_ids)
  on conflict (user_id, book_id) do nothing;
end;
$$;

revoke execute on function public.apply_cross_group_read_matches(uuid, uuid[]) from public, anon;
