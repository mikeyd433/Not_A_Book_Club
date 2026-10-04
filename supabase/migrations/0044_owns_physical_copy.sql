-- Lets a reader flag that they own a physical copy of a book and are
-- willing to loan it out, shown on the book's Overview so the group knows
-- who to ask. Per-shelf-entry like muted/spoil_me/is_rereading -- it's a
-- fact about *this reader's* relationship to the book, not the book
-- itself, so it belongs here rather than on `books`. No new RLS needed:
-- shelf_entries is already readable by the whole group and writable by
-- its own owner (0004's "members can read shelf entries in their group" /
-- "users manage their own shelf entry" policies cover any column,
-- including this one).
alter table public.shelf_entries
  add column owns_physical_copy boolean not null default false;
