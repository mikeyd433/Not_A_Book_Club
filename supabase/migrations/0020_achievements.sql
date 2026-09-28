-- Achievements: participation-based, never speed-based -- deliberately no
-- "first in the group to X" achievement, only per-person milestones each
-- reader unlocks on their own timeline. Computed by triggers (not a daily
-- job -- every one of these fires off a row that already exists) on the
-- tables that already track the underlying activity.

-- Static catalog. "hidden" is a client-side rendering hint only (show
-- "???" for a hidden achievement you haven't earned instead of its name/
-- description) -- this is a small private friend group and the stakes of
-- someone peeking at the catalog directly are low, so this table doesn't
-- need its own per-viewer masking the way achievements_earned does below.
create table public.achievements (
  key text primary key,
  name text not null,
  description text not null,
  hidden boolean not null default false
);

alter table public.achievements enable row level security;

create policy "achievements catalog is readable by authenticated users"
  on public.achievements for select
  to authenticated
  using (true);

insert into public.achievements (key, name, description, hidden) values
  ('first_shelf', 'Bookworm-to-Be', 'Added your first book to your shelf.', false),
  ('first_finish', 'Turned the Last Page', 'Finished your first book.', false),
  ('first_comment', 'Joined the Conversation', 'Posted your first comment.', false),
  ('first_prediction', 'Fortune Teller', 'Made your first prediction.', false),
  ('first_rating', 'Critic', 'Posted your first rating or review.', false),
  ('first_reread', 'Déjà Read', 'Finished your first reread.', false),
  ('group_founder', 'Founder', 'Created the group.', false),
  ('bookworm', 'Bookworm', 'Finished 5 books.', true),
  ('chatterbox', 'Chatterbox', 'Posted 25 comments.', true),
  ('prophet', 'Prophet', 'Got 5 predictions right.', true);

-- Who's earned what. One row per (user, achievement) -- every achievement
-- is a one-time unlock, even the cumulative ones (5 books, 25 comments).
-- book_id is which book triggered it, kept for context/display.
--
-- No select/insert/update/delete policies at all: RLS is enabled with
-- nothing permissive, so this table is unreachable directly via PostgREST
-- for any client role. Every write happens through the SECURITY DEFINER
-- trigger functions below (same pattern as handle_new_user() provisioning
-- profiles on signup), and every read happens through achievements_feed()
-- further down, because "book-specific details hidden until the viewer has
-- finished that book" needs to null out book_id/title per viewer per row --
-- a column-level mask RLS can't express, since RLS filters whole rows, not
-- individual column values within a row a viewer is otherwise allowed to
-- see. (Book titles themselves are NOT spoiler-gated in the books table --
-- see 0002 -- so resolving book_id there instead would leak exactly the
-- detail this is meant to hide.)
create table public.achievements_earned (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_key text not null references public.achievements (key),
  book_id uuid references public.books (id) on delete set null,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);

alter table public.achievements_earned enable row level security;

create function public.award_achievement(p_user_id uuid, p_key text, p_book_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.achievements_earned (user_id, achievement_key, book_id)
  values (p_user_id, p_key, p_book_id)
  on conflict (user_id, achievement_key) do nothing;
end;
$$;

create function public.trg_award_group_founder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_achievement(new.created_by, 'group_founder', null);
  return new;
end;
$$;

create trigger award_group_founder
  after insert on public.groups
  for each row execute function public.trg_award_group_founder();

create function public.trg_award_shelf_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_finished_count integer;
begin
  if tg_op = 'INSERT' then
    perform public.award_achievement(new.user_id, 'first_shelf', new.book_id);
    return new;
  end if;

  if new.status = 'finished' and old.status is distinct from 'finished' then
    perform public.award_achievement(new.user_id, 'first_finish', new.book_id);

    select count(*) into v_finished_count
      from public.shelf_entries
      where user_id = new.user_id and status = 'finished';
    if v_finished_count >= 5 then
      perform public.award_achievement(new.user_id, 'bookworm', new.book_id);
    end if;
  end if;

  if old.is_rereading and not new.is_rereading then
    perform public.award_achievement(new.user_id, 'first_reread', new.book_id);
  end if;

  return new;
end;
$$;

create trigger award_shelf_achievements
  after insert or update on public.shelf_entries
  for each row execute function public.trg_award_shelf_achievements();

create function public.trg_award_comment_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  perform public.award_achievement(new.user_id, 'first_comment', new.book_id);

  select count(*) into v_count from public.comments where user_id = new.user_id;
  if v_count >= 25 then
    perform public.award_achievement(new.user_id, 'chatterbox', new.book_id);
  end if;

  return new;
end;
$$;

create trigger award_comment_achievements
  after insert on public.comments
  for each row execute function public.trg_award_comment_achievements();

create function public.trg_award_prediction_achievements()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_correct_count integer;
begin
  if tg_op = 'INSERT' then
    perform public.award_achievement(new.user_id, 'first_prediction', new.book_id);
    return new;
  end if;

  if new.verdict = 'correct' and old.verdict is distinct from 'correct' then
    select count(*) into v_correct_count
      from public.predictions
      where user_id = new.user_id and verdict = 'correct';
    if v_correct_count >= 5 then
      perform public.award_achievement(new.user_id, 'prophet', new.book_id);
    end if;
  end if;

  return new;
end;
$$;

create trigger award_prediction_achievements
  after insert or update on public.predictions
  for each row execute function public.trg_award_prediction_achievements();

create function public.trg_award_rating_achievement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_achievement(new.user_id, 'first_rating', new.book_id);
  return new;
end;
$$;

create trigger award_rating_achievement
  after insert on public.ratings
  for each row execute function public.trg_award_rating_achievement();

-- The read path: any group member can see any shared group-mate's earned
-- achievements ("shown on profiles and announced in the feed"), but
-- book_id/book_title are nulled out per-row unless the viewer is the
-- earner or already has_full_access() to that book.
create function public.achievements_feed()
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  achievement_key text,
  name text,
  description text,
  hidden boolean,
  book_id uuid,
  book_title text,
  earned_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    ae.id,
    ae.user_id,
    pr.display_name,
    ae.achievement_key,
    a.name,
    a.description,
    a.hidden,
    case
      when ae.book_id is null then null
      when ae.user_id = auth.uid() or public.has_full_access(auth.uid(), ae.book_id) then ae.book_id
      else null
    end as book_id,
    case
      when ae.book_id is null then null
      when ae.user_id = auth.uid() or public.has_full_access(auth.uid(), ae.book_id) then b.title
      else null
    end as book_title,
    ae.earned_at
  from public.achievements_earned ae
  join public.achievements a on a.key = ae.achievement_key
  join public.profiles pr on pr.id = ae.user_id
  left join public.books b on b.id = ae.book_id
  where exists (
    select 1 from public.group_members gm1
    join public.group_members gm2 on gm2.group_id = gm1.group_id
    where gm1.user_id = ae.user_id and gm2.user_id = auth.uid()
  )
  order by ae.earned_at desc;
$$;

revoke execute on function public.award_achievement(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.trg_award_group_founder() from public, anon, authenticated;
revoke execute on function public.trg_award_shelf_achievements() from public, anon, authenticated;
revoke execute on function public.trg_award_comment_achievements() from public, anon, authenticated;
revoke execute on function public.trg_award_prediction_achievements() from public, anon, authenticated;
revoke execute on function public.trg_award_rating_achievement() from public, anon, authenticated;
revoke execute on function public.achievements_feed() from public, anon;
