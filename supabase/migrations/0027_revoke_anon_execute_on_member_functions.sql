-- These are all app-internal RPCs meant for signed-in members of a
-- private, invite-only book club. The security advisor flagged them as
-- callable by the anon (unauthenticated) role via PostgREST, which has no
-- legitimate use here -- there's no pre-login functionality in NABC that
-- needs them, and letting anon call join_group_by_code / create_group
-- unauthenticated is a real (if narrow) abuse surface, e.g. invite-code
-- brute-forcing without even needing an account.
--
-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default on function
-- creation, and every role (anon included) inherits through PUBLIC
-- regardless of a per-role revoke -- so this revokes from PUBLIC itself
-- and re-grants to authenticated so signed-in members keep access.
revoke execute on function public.create_group(text) from public;
grant execute on function public.create_group(text) to authenticated;

revoke execute on function public.has_full_access(uuid, uuid) from public;
grant execute on function public.has_full_access(uuid, uuid) to authenticated;

revoke execute on function public.is_chapter_unlocked(uuid, uuid, uuid) from public;
grant execute on function public.is_chapter_unlocked(uuid, uuid, uuid) to authenticated;

revoke execute on function public.is_currently_reading(uuid) from public;
grant execute on function public.is_currently_reading(uuid) to authenticated;

revoke execute on function public.is_group_admin(uuid) from public;
grant execute on function public.is_group_admin(uuid) to authenticated;

revoke execute on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;

revoke execute on function public.join_group_by_code(text) from public;
grant execute on function public.join_group_by_code(text) to authenticated;

revoke execute on function public.locked_comment_count(uuid) from public;
grant execute on function public.locked_comment_count(uuid) to authenticated;

revoke execute on function public.set_default_cover(uuid, uuid) from public;
grant execute on function public.set_default_cover(uuid, uuid) to authenticated;
