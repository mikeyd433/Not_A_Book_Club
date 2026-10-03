-- Tracks when each reader last viewed a book's Discussion tab, so Home's
-- "unlocked comments" badge can show activity since then instead of an
-- ever-growing all-time total that never clears.
alter table public.shelf_entries add column comments_seen_at timestamptz;
