-- Tracks which chapters a member has chosen to reveal comments for, so
-- each newly-reached chapter defaults to hidden (letting them write their
-- own reaction before reading others') without needing to re-toggle for
-- every new chapter, while a chapter already revealed earlier stays that
-- way on future visits -- a per-reader, per-book, per-chapter preference,
-- not a session-only UI state.
alter table public.shelf_entries add column revealed_chapter_ids uuid[] not null default '{}';
