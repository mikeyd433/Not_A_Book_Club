-- Flags a profile as an admin-created disposable test account (see the
-- test-accounts edge function) rather than a real group member. The
-- account-deletion path in that function refuses to run on any profile
-- where this isn't true, so this column is the one thing standing between
-- "delete this test account" and "delete any member" -- never settable by
-- anything but that function's service-role client.
alter table public.profiles add column is_test_account boolean not null default false;
