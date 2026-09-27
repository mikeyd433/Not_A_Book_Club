-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default when a
-- function is created. Revoking from a named role (anon) alone is a no-op
-- if the role was only ever inheriting via that implicit PUBLIC grant --
-- the earlier 0014 migration made exactly this mistake. Revoke from PUBLIC
-- itself, matching the pattern already used in 0006 for the trigger-only
-- functions.
revoke execute on function public.flag_comment(uuid) from public, anon;
revoke execute on function public.resolve_comment_flag(uuid, uuid) from public, anon;

-- guard_comment_flagging was also re-granted to authenticated during
-- interactive debugging of the flag-visibility bug fixed in 0014, and
-- never re-revoked.
revoke execute on function public.guard_comment_flagging() from public, anon, authenticated;
