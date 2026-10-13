-- Now that a transfer can carry over a whole discussion tree, the replies
-- in it are a mix of the caller's own words (which belong on the thread
-- same as anything else they post) and other old-group members' replies
-- to them, surfaced without those members ever having joined the new
-- group. The UI wants to default those other-members' replies to
-- collapsed, with a tap-to-reveal indicator naming where they came from --
-- but it can't tell which comments those are without the DB marking them.
--
-- Add comments.transferred_from_group_id, set only on rows inserted by
-- apply_shelf_transfer's comment-copy loop, to the *old* book's group --
-- i.e. the group the content is actually coming from. Left null for
-- every ordinarily-posted comment (the overwhelming majority), including
-- ones created directly by shelf transfer's non-comment paths (there are
-- none -- the only insert into public.comments anywhere is this loop).
--
-- on delete set null (not cascade): if the old group is later deleted,
-- the copied comment is a fully independent row in the new group's own
-- discussion and should simply stop citing a source rather than vanish
-- with it.
--
-- Indexed partially (where not null) since the marker is rare and is
-- only ever queried as "does this comment have one" / "which group",
-- matching this project's existing convention of partial-indexing sparse
-- nullable flag/FK columns (e.g. current_chapter_id).

alter table public.comments
  add column transferred_from_group_id uuid references public.groups(id) on delete set null;

create index comments_transferred_from_group_id_idx
  on public.comments (transferred_from_group_id)
  where transferred_from_group_id is not null;

-- CREATE OR REPLACE rather than a new function -- apply_shelf_transfer's
-- signature and return type are unchanged, only its body (now stamping
-- transferred_from_group_id on every comment it inserts, root or reply
-- alike, to the old book's group).

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
  v_old_group_id uuid;
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
      select b.group_id into v_old_group_id
      from public.books b
      where b.id = rec.old_book_id;

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
            made_during_reread, no_spoilers, transferred_from_group_id
          ) values (
            v_new_book_id, v_new_comment_chapter_id, cm.user_id, cm.body, cm.created_at,
            v_new_parent_comment_id, cm.made_during_reread, cm.no_spoilers, v_old_group_id
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
