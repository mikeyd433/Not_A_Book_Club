-- The per-book discussion thread. Foundation scope: text comments tagged to
-- a chapter, nested replies. Reactions, predictions, attachments, and
-- spoiler-flagging land in later migrations without touching this table's
-- shape (comments.chapter_id is the only thing the lock rule cares about).

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null,
  made_during_reread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comments enable row level security;

-- Visibility: reader.has_full_access OR chapter position <= reader's
-- current position (per spec) -- OR it's your own comment, since you
-- always know what you wrote. Enforced here in RLS, not just the client.
create policy "unlocked comments are readable"
  on public.comments for select
  to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = comments.book_id and public.is_group_member(books.group_id)
    )
    and (
      user_id = auth.uid()
      or public.is_chapter_unlocked(auth.uid(), book_id, chapter_id)
    )
  );

-- You can only tag a comment at or before your own current chapter -- you
-- can't post "ahead" of where you've read.
create policy "members can post comments up to their own position"
  on public.comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.books
      where books.id = comments.book_id and public.is_group_member(books.group_id)
    )
    and public.is_chapter_unlocked(auth.uid(), book_id, chapter_id)
  );

create policy "authors can edit their own comments"
  on public.comments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "authors can delete their own comments"
  on public.comments for delete
  to authenticated
  using (user_id = auth.uid());

create index comments_book_chapter_idx on public.comments (book_id, chapter_id);
create index comments_parent_idx on public.comments (parent_id);
