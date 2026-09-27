-- Books and their cover gallery. Default-cover resolution order (spec):
--   1. the adder's chosen cover (== whichever cover they upload at add time)
--   2. the first uploaded cover
--   3. the Open Library cover
--   4. a generated placeholder (client-side, from title + accent_color)
-- Both (1) and (2) collapse to "the first cover row inserted for the book",
-- handled by a trigger below. After that, only an admin may change it.

create table public.books (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  open_library_id text,
  title text not null,
  author text,
  open_library_cover_url text,
  default_cover_id uuid,
  accent_color text,
  added_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.covers (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.books
  add constraint books_default_cover_id_fkey
  foreign key (default_cover_id) references public.covers (id) on delete set null;

alter table public.books enable row level security;
alter table public.covers enable row level security;

create policy "members can read their group's books"
  on public.books for select
  to authenticated
  using (public.is_group_member(group_id));

create policy "members can add books"
  on public.books for insert
  to authenticated
  with check (public.is_group_member(group_id) and added_by = auth.uid());

-- default_cover_id changes are additionally gated by the trigger below;
-- this policy just covers "which rows can be updated at all" (any member,
-- e.g. to fix a title/author typo).
create policy "members can update their group's books"
  on public.books for update
  to authenticated
  using (public.is_group_member(group_id));

create policy "members can read covers for their group's books"
  on public.covers for select
  to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = covers.book_id and public.is_group_member(books.group_id)
    )
  );

create policy "members can upload covers"
  on public.covers for insert
  to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.books
      where books.id = covers.book_id and public.is_group_member(books.group_id)
    )
  );

-- Uploaders can delete their own covers; the current default is admin-only
-- (checked here since deleting the default would otherwise silently null it).
create policy "uploaders can delete their own non-default covers"
  on public.covers for delete
  to authenticated
  using (
    uploaded_by = auth.uid()
    and not exists (
      select 1 from public.books where books.default_cover_id = covers.id
    )
  );

create policy "admins can delete any cover including the default"
  on public.covers for delete
  to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = covers.book_id and public.is_group_admin(books.group_id)
    )
  );

create function public.set_first_cover_as_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.books
  set default_cover_id = new.id
  where id = new.book_id and default_cover_id is null;
  return new;
end;
$$;

create trigger on_cover_uploaded
  after insert on public.covers
  for each row execute function public.set_first_cover_as_default();

create function public.guard_default_cover_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.default_cover_id is distinct from old.default_cover_id
     and old.default_cover_id is not null
     and not public.is_group_admin(old.group_id) then
    raise exception 'Only an admin can change a book''s default cover';
  end if;
  return new;
end;
$$;

create trigger guard_default_cover
  before update of default_cover_id on public.books
  for each row execute function public.guard_default_cover_change();

-- RPC used by the admin-only "change default cover" UI action.
create function public.set_default_cover(p_book_id uuid, p_cover_id uuid)
returns public.books
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book public.books;
begin
  select * into v_book from public.books where id = p_book_id;

  if v_book.id is null then
    raise exception 'Book not found';
  end if;

  if not public.is_group_admin(v_book.group_id) then
    raise exception 'Only an admin can change a book''s default cover';
  end if;

  update public.books set default_cover_id = p_cover_id where id = p_book_id
  returning * into v_book;

  return v_book;
end;
$$;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy "anyone can view cover images"
  on storage.objects for select
  using (bucket_id = 'covers');

create policy "authenticated users can upload covers"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'covers');

create policy "uploaders can delete their own cover files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'covers' and owner = auth.uid());
