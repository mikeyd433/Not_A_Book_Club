-- "the poster or an admin retags or removes it" -- retagging is covered by
-- the admin UPDATE policy from 0009, but removal needs its own DELETE
-- policy since the existing one only lets the author delete their own.
create policy "admins can delete flagged comments"
  on public.comments for delete
  to authenticated
  using (
    flagged
    and exists (
      select 1 from public.books
      where books.id = comments.book_id and public.is_group_admin(books.group_id)
    )
  );
