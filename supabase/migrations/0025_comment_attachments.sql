-- Photo attachments on comments (the "photos" half of the spec's "Content:
-- text, photos, and GIFs" -- GIFs stay deferred, they need a third-party
-- API key that isn't part of this project's stack yet).
--
-- Unlike covers (public bucket, no spoiler concern -- book art isn't
-- plot), an attached photo is exactly as spoiler-sensitive as the comment
-- it's on, so it needs the same is_chapter_unlocked() gate all the way
-- down to the storage layer -- a private bucket with RLS keyed off this
-- table, not a public bucket. book_id/chapter_id are denormalized here
-- (rather than joining to comments in every policy) the same way
-- spoiler_blocks does it in 0011, for the same reason: the row is
-- immutable once posted (insert + delete by the author only, no update),
-- so there's nothing to keep in sync.

create table public.comment_attachments (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.comment_attachments enable row level security;

create policy "unlocked comment attachments are readable"
  on public.comment_attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.comments c
      where c.id = comment_attachments.comment_id and c.user_id = auth.uid()
    )
    or public.is_chapter_unlocked(auth.uid(), book_id, chapter_id)
  );

create policy "comment authors can add attachments to their own comment"
  on public.comment_attachments for insert
  to authenticated
  with check (
    exists (
      select 1 from public.comments c
      where c.id = comment_attachments.comment_id
        and c.user_id = auth.uid()
        and c.book_id = comment_attachments.book_id
    )
    and public.is_chapter_unlocked(auth.uid(), book_id, chapter_id)
  );

create policy "authors can delete their own comment attachments"
  on public.comment_attachments for delete
  to authenticated
  using (
    exists (
      select 1 from public.comments c
      where c.id = comment_attachments.comment_id and c.user_id = auth.uid()
    )
  );

create index comment_attachments_comment_idx on public.comment_attachments (comment_id);

-- Private bucket (unlike 'covers'): storage.objects RLS mirrors the table
-- policy above, keyed by matching the object's path back to its row here.
-- Client access goes through createSignedUrl(), not getPublicUrl(), since
-- a public URL would bypass RLS entirely regardless of what's set here.
insert into storage.buckets (id, name, public)
values ('comment-attachments', 'comment-attachments', false)
on conflict (id) do nothing;

create policy "comment attachment files follow the same unlock rule"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'comment-attachments'
    and exists (
      select 1 from public.comment_attachments ca
      where ca.storage_path = storage.objects.name
        and (
          exists (
            select 1 from public.comments c
            where c.id = ca.comment_id and c.user_id = auth.uid()
          )
          or public.is_chapter_unlocked(auth.uid(), ca.book_id, ca.chapter_id)
        )
    )
  );

create policy "authenticated users can upload comment attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'comment-attachments' and owner = auth.uid());

create policy "uploaders can delete their own comment attachment files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'comment-attachments' and owner = auth.uid());
