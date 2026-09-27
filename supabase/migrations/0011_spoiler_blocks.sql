-- Inline spoiler blocks (Discord-style ||spoiler||), each independently
-- chapter-tagged. The comment body stores a placeholder marker
-- (⟦spoiler:N⟧) at each block's position; a locked block's row is hidden
-- entirely by RLS, same principle as top-level comments — the client
-- can't reveal what it was never sent, it can only render "still locked"
-- for a marker with no matching row. Immutable once posted: no update
-- policy, only insert (by the comment's own author, at post time) and
-- delete (also author-only).

create table public.spoiler_blocks (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  ordinal integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (comment_id, ordinal)
);

alter table public.spoiler_blocks enable row level security;

create policy "unlocked spoiler blocks are readable"
  on public.spoiler_blocks for select
  to authenticated
  using (
    exists (
      select 1 from public.comments c
      where c.id = spoiler_blocks.comment_id and c.user_id = auth.uid()
    )
    or public.is_chapter_unlocked(auth.uid(), book_id, chapter_id)
  );

create policy "comment authors can add spoiler blocks to their own comment"
  on public.spoiler_blocks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.comments c
      where c.id = spoiler_blocks.comment_id
        and c.user_id = auth.uid()
        and c.book_id = spoiler_blocks.book_id
    )
    and public.is_chapter_unlocked(auth.uid(), book_id, chapter_id)
  );

create policy "authors can delete their own spoiler blocks"
  on public.spoiler_blocks for delete
  to authenticated
  using (
    exists (
      select 1 from public.comments c
      where c.id = spoiler_blocks.comment_id and c.user_id = auth.uid()
    )
  );

create index spoiler_blocks_comment_idx on public.spoiler_blocks (comment_id);
