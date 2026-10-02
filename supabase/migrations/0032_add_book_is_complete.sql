-- Lets a reader flag that a book's chapter list is final (no more chapters
-- expected) -- purely informational, not a lock: editing the chapter list
-- (including adding more later, or unmarking this) is still governed by
-- the existing "members can update their group's books" / is_currently_reading
-- policies, unaffected by this column.
alter table public.books add column is_complete boolean not null default false;
