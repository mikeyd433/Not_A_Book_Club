-- Star ratings + reviews ("Finishing Extras"). Unlike predictions, there's
-- no competitive/tamper-proof angle here -- it's a personal opinion, so
-- plain owner-scoped update/delete is enough, no guard trigger needed.
--
-- One row per "attempt" rather than one column on shelf_entries, so a
-- reread can add a fresh rating (is_reread = true) without overwriting the
-- original -- that's the "reread rating history" the spec calls for.
-- is_dnf mirrors the reader's shelf status at the time they rated, so the
-- group average can exclude DNF ratings ("DNF handled separately") without
-- a join back to shelf_entries (whose status can keep changing later).
--
-- Visibility gate is has_full_access() alone, not is_chapter_unlocked(): a
-- review isn't tagged to a chapter, it's "have *you*, the viewer, finished
-- this book at all" -- same reasoning as the prediction scoreboard. Insert
-- requires the same, which is what makes "Reviews, locked until finished"
-- true on both ends (can't be written, and can't be read, before then).

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  review text,
  is_dnf boolean not null default false,
  is_reread boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.ratings enable row level security;

create policy "ratings are visible once you've finished, or to their author"
  on public.ratings for select
  to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = ratings.book_id and public.is_group_member(books.group_id)
    )
    and (
      user_id = auth.uid()
      or public.has_full_access(auth.uid(), book_id)
    )
  );

create policy "members can rate a book once they have full access to it"
  on public.ratings for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.books
      where books.id = ratings.book_id and public.is_group_member(books.group_id)
    )
    and public.has_full_access(auth.uid(), book_id)
  );

create policy "authors can edit their own rating"
  on public.ratings for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "authors can delete their own rating"
  on public.ratings for delete
  to authenticated
  using (user_id = auth.uid());

create index ratings_book_idx on public.ratings (book_id);
