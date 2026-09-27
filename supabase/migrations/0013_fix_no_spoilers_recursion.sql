-- The no_spoilers reply cap was implemented as a self-referencing subquery
-- in the comments INSERT policy's WITH CHECK (querying public.comments
-- from within a policy defined ON public.comments). Postgres detects that
-- as circular policy evaluation and refuses it outright ("infinite
-- recursion detected in policy for relation comments") rather than
-- actually looping — so nothing this policy guards could be inserted at
-- all. A SECURITY DEFINER trigger sidesteps the problem entirely: it reads
-- the parent row directly, without going back through comments' own RLS.

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
  );

create function public.enforce_no_spoilers_reply_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_no_spoilers boolean;
  v_parent_position integer;
  v_this_position integer;
begin
  if new.parent_id is null then
    return new;
  end if;

  select c.no_spoilers, ch.position
    into v_parent_no_spoilers, v_parent_position
    from public.comments c
    join public.chapters ch on ch.id = c.chapter_id
    where c.id = new.parent_id;

  if not coalesce(v_parent_no_spoilers, false) then
    return new;
  end if;

  select position into v_this_position from public.chapters where id = new.chapter_id;

  if v_this_position > v_parent_position then
    raise exception 'This question is marked "no spoilers please" -- replies can''t be tagged past chapter %', v_parent_position;
  end if;

  return new;
end;
$$;

create trigger enforce_no_spoilers_reply_cap
  before insert on public.comments
  for each row execute function public.enforce_no_spoilers_reply_cap();

revoke execute on function public.enforce_no_spoilers_reply_cap() from public, anon, authenticated;
