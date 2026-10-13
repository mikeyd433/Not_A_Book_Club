-- 0054 limited which replies got copied to whatever the caller was
-- *currently* allowed to see (unlocked for their own reading position in
-- the old group). That was backwards: the whole point of chapter-locking
-- is that it's enforced per viewer at read time -- a reply on a chapter
-- the caller hasn't reached yet is already correctly hidden from them
-- (and from anyone else not there yet), in the old group or the new one.
-- There's no reason to *also* gate what gets copied by the caller's own
-- progress; doing so meant a reply sitting past the caller's own current
-- chapter would never make the trip at all, even though it's exactly the
-- kind of content other members in the new group should get to unlock as
-- they read -- the async, catch-up-at-your-own-pace discussion this app
-- is built around.
--
-- Now: every reply to the caller's own comments comes along, recursively,
-- regardless of chapter -- the destination group's own per-viewer
-- chapter-unlock check (is_chapter_unlocked, applied fresh there once
-- it's a real comment in a real thread) takes it from there, same as any
-- other comment. Flagged content still doesn't copy (a moderation
-- decision, not a spoiler one) unless it's the caller's own, matching
-- 0054's existing "every copy starts unflagged" reasoning.
--
-- Verified live with seeded throwaway groups/books/users: a reply from
-- another member on a chapter *past* the caller's own current position
-- (previously excluded as "locked for me") now correctly copies, with
-- its chapter remapped the same as any other; a flagged reply from
-- another member still doesn't copy; the caller's own content (anywhere
-- in the tree, any chapter) still always copies; re-verified the
-- unrelated-root-comment exclusion and the nested-reply parent-linking
-- fix from 0056 both still hold.
--
-- CREATE OR REPLACE rather than a new function -- signature and return
-- type unchanged, only the recursive CTE's filter.

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
  v_pass_copied boolean;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  create temporary table _shelf_transfer_comment_map (old_id uuid primary key, new_id uuid)
    on commit drop;
  create temporary table _shelf_transfer_pending (
    source_book_id uuid,
    id uuid primary key,
    parent_id uuid,
    chapter_id uuid,
    user_id uuid,
    body text,
    created_at timestamptz,
    made_during_reread boolean,
    no_spoilers boolean
  ) on commit drop;

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

      insert into _shelf_transfer_pending
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
          and (r.user_id = auth.uid() or not r.flagged)
      )
      select rec.old_book_id, id, parent_id, chapter_id, user_id, body, created_at,
             made_during_reread, no_spoilers
      from to_copy;

      loop
        v_pass_copied := false;

        for cm in
          select p.*
          from _shelf_transfer_pending p
          where p.source_book_id = rec.old_book_id
            and not exists (
              select 1 from _shelf_transfer_comment_map m where m.old_id = p.id
            )
            and (
              p.parent_id is null
              or exists (select 1 from _shelf_transfer_comment_map m where m.old_id = p.parent_id)
            )
        loop
          v_pass_copied := true;

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

        exit when not v_pass_copied;
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
