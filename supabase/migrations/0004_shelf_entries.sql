-- Each reader's personal relationship to a book: shelf status, current
-- position, and the per-reader settings that drive the spoiler-lock rule.
-- "Everyone can see everyone's progress" -> shelf_entries are readable by
-- the whole group, not just their owner.

create table public.shelf_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  status text not null default 'want_to_read' check (
    status in ('reading', 'paused', 'finished', 'dnf', 'read_before_joining', 'want_to_read')
  ),
  current_chapter_id uuid references public.chapters (id) on delete set null,
  personal_cover_id uuid references public.covers (id) on delete set null,
  spoil_me boolean not null default false,
  is_rereading boolean not null default false,
  sort_pref text not null default 'chapter' check (
    sort_pref in ('chapter', 'newest', 'recently_unlocked', 'most_reactions')
  ),
  muted boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

alter table public.shelf_entries enable row level security;

create policy "members can read shelf entries in their group"
  on public.shelf_entries for select
  to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = shelf_entries.book_id and public.is_group_member(books.group_id)
    )
  );

create policy "users manage their own shelf entry"
  on public.shelf_entries for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- === chapter-list editing, now that "currently reading" is defined =========

create function public.is_currently_reading(p_book_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shelf_entries
    where book_id = p_book_id and user_id = auth.uid() and status in ('reading', 'paused')
  );
$$;

create policy "current readers can add chapters"
  on public.chapters for insert
  to authenticated
  with check (
    exists (
      select 1 from public.books
      where books.id = chapters.book_id and public.is_group_member(books.group_id)
    )
    and public.is_currently_reading(chapters.book_id)
  );

create policy "current readers can edit chapters"
  on public.chapters for update
  to authenticated
  using (public.is_currently_reading(chapters.book_id));

create policy "current readers can remove chapters"
  on public.chapters for delete
  to authenticated
  using (public.is_currently_reading(chapters.book_id));

-- === spoiler-lock primitives, reused by comments (0005) and later features ==

create function public.has_full_access(p_user_id uuid, p_book_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shelf_entries
    where user_id = p_user_id
      and book_id = p_book_id
      and (
        status in ('finished', 'read_before_joining')
        or (status = 'dnf' and spoil_me)
      )
  );
$$;

-- True if `p_chapter_id` is at or before the reader's current position, or
-- they have full access. False (nothing unlocked) if they haven't added the
-- book to their shelf, or haven't set a current chapter yet.
create function public.is_chapter_unlocked(p_user_id uuid, p_book_id uuid, p_chapter_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.has_full_access(p_user_id, p_book_id)
    or exists (
      select 1
      from public.shelf_entries se
      join public.chapters reader_ch on reader_ch.id = se.current_chapter_id
      join public.chapters target_ch on target_ch.id = p_chapter_id
      where se.user_id = p_user_id
        and se.book_id = p_book_id
        and target_ch.position <= reader_ch.position
    );
$$;
