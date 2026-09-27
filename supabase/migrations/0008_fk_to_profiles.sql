-- PostgREST can only auto-embed a relationship ("select *, profiles(...)")
-- when there's a foreign key between the two tables actually being
-- queried. profiles.id and these columns both reference auth.users(id),
-- but that makes them siblings, not directly related -- embedding needs
-- the FK to point at public.profiles itself. Safe to repoint: every
-- auth.users row gets a profiles row via the signup trigger (0001), so
-- existing values already satisfy the new target.

alter table public.groups drop constraint groups_created_by_fkey;
alter table public.groups
  add constraint groups_created_by_fkey foreign key (created_by) references public.profiles (id);

alter table public.books drop constraint books_added_by_fkey;
alter table public.books
  add constraint books_added_by_fkey foreign key (added_by) references public.profiles (id);

alter table public.covers drop constraint covers_uploaded_by_fkey;
alter table public.covers
  add constraint covers_uploaded_by_fkey foreign key (uploaded_by) references public.profiles (id) on delete set null;

alter table public.group_members drop constraint group_members_user_id_fkey;
alter table public.group_members
  add constraint group_members_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.chapter_edits drop constraint chapter_edits_user_id_fkey;
alter table public.chapter_edits
  add constraint chapter_edits_user_id_fkey foreign key (user_id) references public.profiles (id);

alter table public.shelf_entries drop constraint shelf_entries_user_id_fkey;
alter table public.shelf_entries
  add constraint shelf_entries_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.comments drop constraint comments_user_id_fkey;
alter table public.comments
  add constraint comments_user_id_fkey foreign key (user_id) references public.profiles (id);
