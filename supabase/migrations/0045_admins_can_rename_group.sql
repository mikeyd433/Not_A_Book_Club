-- No UPDATE policy existed on groups at all -- an admin couldn't change
-- the group's name (or anything else on the row) through the normal
-- client path. Scoped to admins, same as every other group-management
-- action (promote/remove members, regenerate invite code).
create policy "admins can update their group"
  on public.groups for update
  to authenticated
  using (public.is_group_admin(id));
