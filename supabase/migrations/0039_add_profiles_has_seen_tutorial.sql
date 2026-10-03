-- Tracks whether this account has been through (or dismissed) the
-- in-app interactive tutorial, so it only auto-offers once per account
-- rather than every session -- Settings' "Replay tutorial" button works
-- regardless of this flag.
alter table public.profiles add column has_seen_tutorial boolean not null default false;
