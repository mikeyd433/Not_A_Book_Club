-- Extends apply_shelf_transfer: when a candidate's book doesn't exist in
-- the destination group yet (so this is creating it fresh, not matching
-- an existing one with its own independent discussion already going),
-- also carry over the comments the caller personally posted on the old
-- book, plus every reply to those -- recursively, by anyone, not just the
-- caller -- limited to whatever the caller is currently allowed to see.
-- That visibility rule mirrors "unlocked comments are readable" (comments
-- RLS): a reply is copied if it's the caller's own, or if it's unflagged
-- and its chapter is currently unlocked for the caller in the *old*
-- book; a reply that fails this (locked ahead of the caller's own
-- position, or flagged) is excluded, and -- since the recursive step only
-- descends from rows already accepted -- so is everything under it, so a
-- locked branch can't resurface via a visible grand-reply.
--
-- Chapter references remap by position: apply_shelf_transfer already
-- copies the old book's entire chapter list in order when creating the
-- new book, so every old chapter has exactly one same-position
-- counterpart there to point the copied comment at.
--
-- Carried over: the comment body, timestamps, parent/child structure
-- (rebuilt against newly-generated ids via a temp old-id -> new-id map,
-- built in creation order so a comment's parent always exists before it
-- does), no_spoilers' spoiler_blocks, and a GIF attachment (gif_url has
-- no file to duplicate). Deliberately NOT carried over: flagged status
-- (every copy starts unflagged -- a moderation outcome from the old
-- group's context doesn't necessarily mean anything in the new one),
-- is_prediction (predictions are tracked in a separate table with no
-- link back to the comment row, so a carried-over "prediction" comment
-- would have nothing to resolve against), reactions (a reaction is a
-- response to the original post in its original context, not something
-- that travels with it), and a storage-uploaded photo attachment (same
-- Storage-vs-SQL limitation as covers in 0052 -- the comment body still
-- copies, just without its photo).
--
-- Verified live with seeded throwaway groups/books/users before shipping:
-- the caller's own root comment (with a no_spoilers spoiler_blocks row
-- and a separate comment with a GIF attachment) copies correctly with
-- its chapter remapped; a reply from another member on an unlocked
-- chapter copies with authorship intact; a reply from another member on
-- a chapter locked for the caller is correctly excluded; the caller's
-- own nested reply to *someone else's* reply is still picked up (the
-- anchor matches on authorship regardless of nesting depth) with its
-- parent correctly pointing at the newly-copied id of what it replied
-- to; an unrelated root comment from another member (not the caller's,
-- not a reply to the caller) is correctly excluded; re-verified the
-- pre-existing reading/paused chapter-rank carryover and the
-- already-existing-match path (no comments copied there) still work
-- exactly as before.
--
-- CREATE OR REPLACE rather than a new function -- apply_shelf_transfer's
-- signature and return type are unchanged, only its body.

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

          union all

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
