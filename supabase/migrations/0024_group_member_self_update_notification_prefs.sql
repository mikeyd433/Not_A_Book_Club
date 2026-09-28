-- group_members only had one UPDATE policy ("admins can update member
-- roles", for the promote-to-admin action), which meant a regular member
-- had no way to update their own row at all -- including the
-- notification_prefs column push notifications' quiet-hours settings need
-- to write to (0022_push_notifications.sql). Adding a self-update policy
-- without also guarding it would let a non-admin change their own `role`
-- column too, since a plain RLS UPDATE policy restricts which rows can be
-- touched, not which columns within them -- same class of problem as
-- guard_default_cover_change in 0002, same fix: a trigger that enforces
-- the column-level rule regardless of which policy let the UPDATE through.
create policy "members can update their own membership row"
  on public.group_members for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create function public.guard_group_member_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_group_admin(old.group_id) then
    raise exception 'Only an admin can change a member''s role';
  end if;
  return new;
end;
$$;

create trigger guard_group_member_role
  before update on public.group_members
  for each row execute function public.guard_group_member_role_change();

revoke execute on function public.guard_group_member_role_change() from public, anon, authenticated;
