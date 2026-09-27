-- Spoiler flagging and the no-spoilers-please tag.
--
-- Flagging: "anyone can flag a comment. It's hidden instantly for readers
-- below its chapter tag until the poster or an admin retags or removes it.
-- Flagging never deletes anything." A flagged comment is hidden from
-- everyone except its author and group admins (who need to see it to
-- moderate it) regardless of the reader's position — this is stricter than
-- the normal lock rule on purpose, since a flag usually means the chapter
-- tag itself was wrong and the normal rule can't be trusted for this row.
--
-- no_spoilers: replies to a comment marked this way are capped at the
-- asker's own chapter position, even if the replier has read further.

alter table public.comments add column flagged boolean not null default false;
alter table public.comments add column no_spoilers boolean not null default false;

drop policy "unlocked comments are readable" on public.comments;
create policy "unlocked comments are readable"
  on public.comments for select
  to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = comments.book_id and public.is_group_member(books.group_id)
    )
    and (
      user_id = auth.uid()
      or (
        not flagged
        and public.is_chapter_unlocked(auth.uid(), book_id, chapter_id)
      )
      or (
        flagged
        and exists (
          select 1 from public.books
          where books.id = comments.book_id and public.is_group_admin(books.group_id)
        )
      )
    )
  );

drop policy "members can post comments up to their own position" on public.comments;
create policy "members can post comments up to their own position"
  on public.comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.books
      where books.id = comments.book_id and public.is_group_member(books.group_id)
    )
    and public.is_chapter_unlocked(auth.uid(), book_id, chapter_id)
    and (
      parent_id is null
      or not exists (
        select 1
        from public.comments parent
        join public.chapters parent_ch on parent_ch.id = parent.chapter_id
        join public.chapters this_ch on this_ch.id = comments.chapter_id
        where parent.id = comments.parent_id
          and parent.no_spoilers
          and this_ch.position > parent_ch.position
      )
    )
  );

-- Any member can flip flagged false -> true on a comment they can currently
-- see. The trigger below is the real guard against this being used to
-- sneak other column changes through; this policy alone would technically
-- allow it (Postgres OR's multiple permissive policies' checks together).
create policy "members can flag a visible comment"
  on public.comments for update
  to authenticated
  using (
    not flagged
    and exists (
      select 1 from public.books
      where books.id = comments.book_id and public.is_group_member(books.group_id)
    )
    and (
      user_id = auth.uid()
      or public.is_chapter_unlocked(auth.uid(), book_id, chapter_id)
    )
  )
  with check (flagged = true);

-- The poster's existing "authors can edit their own comments" policy
-- already lets them retag/resolve their own flagged comment. Admins need
-- their own path since they aren't the author.
create policy "admins can moderate flagged comments"
  on public.comments for update
  to authenticated
  using (
    flagged
    and exists (
      select 1 from public.books
      where books.id = comments.book_id and public.is_group_admin(books.group_id)
    )
  )
  with check (
    exists (
      select 1 from public.books
      where books.id = comments.book_id and public.is_group_admin(books.group_id)
    )
  );

create function public.guard_comment_flagging()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.flagged and not old.flagged then
    if new.user_id <> old.user_id
       or new.chapter_id <> old.chapter_id
       or new.parent_id is distinct from old.parent_id
       or new.body <> old.body
       or new.book_id <> old.book_id
       or new.made_during_reread <> old.made_during_reread
       or new.no_spoilers <> old.no_spoilers
    then
      raise exception 'Flagging a comment cannot change anything else about it';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_comment_flagging
  before update on public.comments
  for each row execute function public.guard_comment_flagging();

revoke execute on function public.guard_comment_flagging() from public, anon, authenticated;

-- Flagged comments are now hidden for a reason other than position, so the
-- locked-ahead count needs to include them too or they'd silently vanish
-- from the "N comments ahead" signal for anyone who was otherwise unlocked.
create or replace function public.locked_comment_count(p_book_id uuid)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)
  from public.comments c
  where c.book_id = p_book_id
    and c.user_id <> auth.uid()
    and (
      not public.is_chapter_unlocked(auth.uid(), c.book_id, c.chapter_id)
      or (
        c.flagged
        and not exists (
          select 1 from public.books
          where books.id = c.book_id and public.is_group_admin(books.group_id)
        )
      )
    );
$$;
