-- copy_chapter_layout() checked is_currently_reading(p_book_id) alone for
-- the destination book, omitting the is_group_member(group_id) check that
-- the original chapters-insert RLS policy (0004, "current readers can add
-- chapters") always pairs it with. That matters because shelf_entries'
-- own write policy ("users manage their own shelf entry", 0004) has no
-- group-membership predicate at all -- it only checks user_id = auth.uid().
-- So anyone could upsert a shelf_entries row for a book in a group they've
-- never joined, making is_currently_reading() true for it, and then call
-- this SECURITY DEFINER RPC to insert chapters straight into another
-- group's book -- bypassing the chapters table's own RLS entirely, since
-- a SECURITY DEFINER function writes as its owner, not through the
-- caller's row-level policies. Caught by code review, confirmed live
-- against the actual shelf_entries policy and the live attack path before
-- this fix; re-verified blocked (and the legitimate same-group path still
-- working) after.
create or replace function public.copy_chapter_layout(p_book_id uuid, p_source_book_id uuid)
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

  if not public.is_group_member(v_group_id) then
    raise exception 'Not a member of this group';
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
