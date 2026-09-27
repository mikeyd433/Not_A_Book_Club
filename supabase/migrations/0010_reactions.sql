-- Emoji reactions. Visibility mirrors the comment they're attached to —
-- you can't see who reacted to a comment you can't see (including one
-- that's flagged and not yours to moderate).

create table public.reactions (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji)
);

alter table public.reactions enable row level security;

create policy "reactions are readable when their comment is"
  on public.reactions for select
  to authenticated
  using (
    exists (
      select 1 from public.comments c
      join public.books b on b.id = c.book_id
      where c.id = reactions.comment_id
        and public.is_group_member(b.group_id)
        and (
          c.user_id = auth.uid()
          or (not c.flagged and public.is_chapter_unlocked(auth.uid(), c.book_id, c.chapter_id))
        )
    )
  );

create policy "members can react to a comment they can see"
  on public.reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.comments c
      join public.books b on b.id = c.book_id
      where c.id = reactions.comment_id
        and public.is_group_member(b.group_id)
        and (
          c.user_id = auth.uid()
          or (not c.flagged and public.is_chapter_unlocked(auth.uid(), c.book_id, c.chapter_id))
        )
    )
  );

create policy "members can remove their own reaction"
  on public.reactions for delete
  to authenticated
  using (user_id = auth.uid());

create index reactions_comment_idx on public.reactions (comment_id);
