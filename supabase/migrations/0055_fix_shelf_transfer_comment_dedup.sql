-- 0054's comment-copy recursive CTE used UNION ALL, which doesn't
-- deduplicate -- a comment that is both the caller's own (matched
-- directly by the anchor term, regardless of where it sits in the tree)
-- *and* a reply to something else already in the set (matched again by
-- the recursive term) would be selected twice, crashing the per-row loop
-- on a duplicate key the second time it tried to insert the same old_id
-- into the id-mapping temp table.
--
-- Caught live: seeded the caller's own nested reply to *another* member's
-- reply (itself a reply to one of the caller's own root comments) --
-- exactly the shape that hits both terms -- and apply_shelf_transfer
-- raised a duplicate-key error instead of completing. Confirmed the
-- whole call rolled back cleanly (zero partial rows left behind), as a
-- single top-level PL/pgSQL call failing on an unhandled exception
-- should.
--
-- Fix: UNION instead of UNION ALL, which deduplicates by full row
-- equality -- effectively by id, since id is one of the selected columns
-- and is already unique.
--
-- Verified live: the same seeded scenario (own root comments including a
-- no_spoilers one with spoiler_blocks, a gif-attached root comment, a
-- reply from another member on an unlocked chapter, a reply from another
-- member on a chapter locked for the caller, the caller's own nested
-- reply to that other member's unlocked reply, and an unrelated root
-- comment from another member) now completes without error. The new
-- book's comments: both of the caller's own root comments copied with
-- chapters correctly remapped, the no_spoilers comment's two
-- spoiler_blocks rows copied, the gif attachment copied, the unlocked
-- reply from the other member copied with its authorship intact, the
-- caller's own nested reply copied with parent_id correctly pointing at
-- the newly-copied id of the reply it was replying to. Correctly
-- excluded: the reply on the chapter locked for the caller, and the
-- unrelated root comment from the other member. Exactly 4 comments
-- copied (2 of the caller's own roots + 1 other-member reply + 1 of the
-- caller's own nested reply), not 5.
--
-- CREATE OR REPLACE rather than a new function -- signature and return
-- type unchanged, only the recursive CTE's set operator.

create or replace function public.apply_shelf_transfer(p_group_id uuid, p_old_book_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  cm record;
  v_new_book_id uuid;
  v_old_rank int;
  v_new_current_chapter_id uuid;
  v_new_status text;
  v_new_comment_id uuid;
  v_new_comment_chapter_id uuid;
  v_new_parent_comment_id uuid;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  create temporary table _shelf_transfer_comment_map (old_id uuid primary key, new_id uuid)
    on commit drop;

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

      for cm in
        with recursive to_copy as (
          select c.id, c.parent_id, c.chapter_id, c.user_id, c.body, c.created_at,
                 c.made_during_reread, c.no_spoilers
          from public.comments c
          where c.book_id = rec.old_book_id and c.user_id = auth.uid()

          union

          select r.id, r.parent_id, r.chapter_id, r.user_id, r.body, r.created_at,
                 r.made_during_reread, r.no_spoilers
          from public.comments r
          join to_copy on r.parent_id = to_copy.id
          where r.book_id = rec.old_book_id
            and (
              r.user_id = auth.uid()
              or (not r.flagged and public.is_chapter_unlocked(auth.uid(), r.book_id, r.chapter_id))
            )
        )
        select * from to_copy order by created_at
      loop
        select nc.id into v_new_comment_chapter_id
        from public.chapters nc
        join public.chapters oc on oc.id = cm.chapter_id
        where nc.book_id = v_new_book_id and nc.position = oc.position;

        select new_id into v_new_parent_comment_id
        from _shelf_transfer_comment_map where old_id = cm.parent_id;

        insert into public.comments (
          book_id, chapter_id, user_id, body, created_at, parent_id,
          made_during_reread, no_spoilers
        ) values (
          v_new_book_id, v_new_comment_chapter_id, cm.user_id, cm.body, cm.created_at,
          v_new_parent_comment_id, cm.made_during_reread, cm.no_spoilers
        )
        returning id into v_new_comment_id;

        insert into _shelf_transfer_comment_map (old_id, new_id) values (cm.id, v_new_comment_id);

        insert into public.spoiler_blocks (comment_id, book_id, chapter_id, ordinal, content)
        select v_new_comment_id, v_new_book_id, v_new_comment_chapter_id, sb.ordinal, sb.content
        from public.spoiler_blocks sb
        where sb.comment_id = cm.id;

        insert into public.comment_attachments (comment_id, book_id, chapter_id, gif_url)
        select v_new_comment_id, v_new_book_id, v_new_comment_chapter_id, ca.gif_url
        from public.comment_attachments ca
        where ca.comment_id = cm.id and ca.gif_url is not null and ca.storage_path is null;
      end loop;
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
