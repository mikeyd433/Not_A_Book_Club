-- Ordered chapter list per book. `position` is the hidden integer used for
-- locking; `label` is the editable display text. Comments/progress reference
-- chapter_id (not position), so inserting e.g. a prologue later doesn't
-- renumber or break existing references.

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  position integer not null,
  label text not null,
  part_label text,
  created_at timestamptz not null default now(),
  unique (book_id, position)
);

create table public.chapter_edits (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.chapters enable row level security;
alter table public.chapter_edits enable row level security;

create policy "members can read their group's chapters"
  on public.chapters for select
  to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = chapters.book_id and public.is_group_member(books.group_id)
    )
  );

-- "Anyone currently reading the book" may edit its chapter list — checked
-- against shelf_entries once that table exists (migration 0004); until then
-- this policy is superseded by the one added there.
create policy "members can read chapter edit history"
  on public.chapter_edits for select
  to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = chapter_edits.book_id and public.is_group_member(books.group_id)
    )
  );

create policy "members can log their own chapter edits"
  on public.chapter_edits for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.books
      where books.id = chapter_edits.book_id and public.is_group_member(books.group_id)
    )
  );
