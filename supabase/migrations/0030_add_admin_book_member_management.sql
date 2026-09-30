-- Admins can delete a book from their group. Deleting cascades through
-- chapters/comments/covers/predictions/ratings/shelf_entries/spoiler_blocks/
-- notification_outbox via existing FK ON DELETE CASCADE constraints;
-- achievements_earned keeps its row with book_id set null instead,
-- preserving earned-achievement history rather than losing it.
create policy "admins can delete their group's books"
on public.books
for delete
using (is_group_admin(group_id));

-- Admins can remove a member from their group.
create policy "admins can remove group members"
on public.group_members
for delete
using (is_group_admin(group_id));

-- Guard: removing a member must never leave a group with zero admins --
-- otherwise the group becomes permanently unmanageable, with no one left
-- who could promote a replacement admin or reverse the mistake.
create or replace function public.guard_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if old.role = 'admin' and not exists (
    select 1 from public.group_members
    where group_id = old.group_id
      and role = 'admin'
      and user_id <> old.user_id
  ) then
    raise exception 'Cannot remove the last admin of a group';
  end if;
  return old;
end;
$$;

create trigger guard_last_admin_removal
before delete on public.group_members
for each row
execute function public.guard_last_admin_removal();

-- guard_last_admin_removal only ever needs to run as a DELETE trigger,
-- which doesn't require EXECUTE on the function for the triggering role --
-- so it gets no grants at all, closing off the /rest/v1/rpc/... endpoint
-- PostgREST otherwise exposes for every function in this schema.
revoke execute on function public.guard_last_admin_removal() from public, anon, authenticated;

-- Admin-only: rotate the invite code, e.g. if it leaked outside the group.
-- Mirrors create_group's own use of generate_invite_code().
create or replace function public.regenerate_invite_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_code text;
begin
  if not public.is_group_admin(p_group_id) then
    raise exception 'Only a group admin can regenerate the invite code';
  end if;

  v_code := public.generate_invite_code();
  update public.groups set invite_code = v_code where id = p_group_id;
  return v_code;
end;
$$;

-- New functions get anon EXECUTE granted directly at creation time
-- (Supabase's default privileges rule for the public schema), separate
-- from the PUBLIC-pseudo-role mechanism that migration 0027 had to work
-- around -- so this revokes from both anon and public to close whichever
-- one actually applies.
revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
