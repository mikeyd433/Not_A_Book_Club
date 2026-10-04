-- Lets someone adding a book that's already set up with chapters in
-- another group reuse that layout instead of retyping the whole table of
-- contents -- matched by open_library_id, the only reliable cross-group
-- identifier (manually-added books have none and are out of scope here).
--
-- Both RPCs are SECURITY DEFINER since a group member otherwise has no
-- RLS access at all to another group's books/chapters. find_chapter_layouts
-- only ever returns a source book id + chapter count, never which group it
-- came from, keeping that boundary intact. copy_chapter_layout re-resolves
-- the source chapters itself server-side (and re-checks the open_library_id
-- actually matches) rather than trusting a client-supplied source id/list,
-- so a crafted call can't pull in an unrelated book's chapters.
--
-- Verified live with seeded throwaway groups/books/users before shipping:
-- find_chapter_layouts correctly surfaces a same-open_library_id match
-- from another group and correctly excludes a different-open_library_id
-- book; copy_chapter_layout correctly copies labels/positions in order,
-- correctly rejects a mismatched source book, and correctly rejects a
-- caller who isn't currently reading the destination book.

create function public.find_chapter_layouts(p_book_id uuid)
returns table(source_book_id uuid, chapter_count integer)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_group_id uuid;
  v_open_library_id text;
begin
  select group_id, open_library_id into v_group_id, v_open_library_id
    from public.books where id = p_book_id;

  if v_group_id is null then
    raise exception 'Book not found';
  end if;

  if not public.is_group_member(v_group_id) then
    raise exception 'Not a member of this group';
  end if;

  if v_open_library_id is null then
    return;
  end if;

  return query
    select b.id, count(c.id)::integer
    from public.books b
    join public.chapters c on c.book_id = b.id
    where b.open_library_id = v_open_library_id
      and b.group_id <> v_group_id
    group by b.id, b.created_at
    order by count(c.id) desc, b.created_at asc;
end;
$$;

revoke execute on function public.find_chapter_layouts(uuid) from public, anon;

create function public.copy_chapter_layout(p_book_id uuid, p_source_book_id uuid)
returns setof public.chapters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_dest_open_library_id text;
  v_source_group_id uuid;
  v_source_open_library_id text;
  v_next_position integer;
begin
  select group_id, open_library_id into v_group_id, v_dest_open_library_id
    from public.books where id = p_book_id;

  if v_group_id is null then
    raise exception 'Book not found';
  end if;

  if not public.is_currently_reading(p_book_id) then
    raise exception 'Only someone currently reading this book can set up its chapters';
  end if;

  select group_id, open_library_id into v_source_group_id, v_source_open_library_id
    from public.books where id = p_source_book_id;

  if v_source_group_id is null
     or v_source_group_id = v_group_id
     or v_dest_open_library_id is null
     or v_source_open_library_id is distinct from v_dest_open_library_id then
    raise exception 'Invalid source layout';
  end if;

  select coalesce(max(position), 0) into v_next_position
    from public.chapters where book_id = p_book_id;

  return query
    insert into public.chapters (book_id, position, label, part_label)
    select
      p_book_id,
      v_next_position + row_number() over (order by c.position),
      c.label,
      c.part_label
    from public.chapters c
    where c.book_id = p_source_book_id
    order by c.position
    returning *;
end;
$$;

revoke execute on function public.copy_chapter_layout(uuid, uuid) from public, anon;
