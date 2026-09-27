-- Postgres requires the acting role to retain SELECT-policy visibility of
-- a row after it UPDATEs it, even when the UPDATE policy's own WITH CHECK
-- is unconditionally true. Flagging is specifically designed to remove the
-- flagger's own visibility of the comment (unless they're the author or an
-- admin) -- so a plain RLS UPDATE policy for "anyone can flag" can never
-- work: Postgres rejects the write as soon as it would make the row
-- invisible to whoever just wrote it, independent of any policy content.
--
-- The fix is the same pattern already used for create_group /
-- join_group_by_code / set_default_cover: do the write inside a SECURITY
-- DEFINER function, which performs the UPDATE as the function owner (not
-- subject to the caller's post-write visibility requirement), after
-- checking authorization manually.

-- Restore the intended (flagged-aware) SELECT policy -- it was temporarily
-- simplified to isolate this bug during testing.
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

drop policy if exists "members can flag a visible comment" on public.comments;
drop policy if exists "admins can moderate flagged comments" on public.comments;

create function public.flag_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_chapter_id uuid;
  v_author_id uuid;
  v_flagged boolean;
begin
  select book_id, chapter_id, user_id, flagged
    into v_book_id, v_chapter_id, v_author_id, v_flagged
    from public.comments
    where id = p_comment_id;

  if v_book_id is null then
    raise exception 'Comment not found';
  end if;

  if v_flagged then
    return; -- already flagged, nothing to do
  end if;

  if not exists (
    select 1 from public.books where books.id = v_book_id and public.is_group_member(books.group_id)
  ) then
    raise exception 'Not a member of this group';
  end if;

  if v_author_id <> auth.uid() and not public.is_chapter_unlocked(auth.uid(), v_book_id, v_chapter_id) then
    raise exception 'You can''t flag a comment you can''t see';
  end if;

  update public.comments set flagged = true where id = p_comment_id;
end;
$$;

create function public.resolve_comment_flag(p_comment_id uuid, p_new_chapter_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
  v_author_id uuid;
  v_flagged boolean;
begin
  select book_id, user_id, flagged
    into v_book_id, v_author_id, v_flagged
    from public.comments
    where id = p_comment_id;

  if v_book_id is null then
    raise exception 'Comment not found';
  end if;

  if not v_flagged then
    raise exception 'This comment isn''t flagged';
  end if;

  if v_author_id <> auth.uid()
     and not exists (
       select 1 from public.books where books.id = v_book_id and public.is_group_admin(books.group_id)
     )
  then
    raise exception 'Only the poster or an admin can resolve a flag';
  end if;

  if p_new_chapter_id is not null and not exists (
    select 1 from public.chapters where id = p_new_chapter_id and book_id = v_book_id
  ) then
    raise exception 'That chapter does not belong to this book';
  end if;

  update public.comments
  set flagged = false,
      chapter_id = coalesce(p_new_chapter_id, chapter_id)
  where id = p_comment_id;
end;
$$;

revoke execute on function public.flag_comment(uuid) from anon;
revoke execute on function public.resolve_comment_flag(uuid, uuid) from anon;
