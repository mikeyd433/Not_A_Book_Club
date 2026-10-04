-- Same mistake 0014 made and 0016 fixed for flag_comment/resolve_comment_flag:
-- revoking from anon alone is a no-op when anon only ever inherited EXECUTE via
-- the implicit PUBLIC grant Postgres creates by default. Revoke from PUBLIC
-- itself.
revoke execute on function public.flag_post(uuid) from public, anon;
revoke execute on function public.resolve_post_flag(uuid) from public, anon;
