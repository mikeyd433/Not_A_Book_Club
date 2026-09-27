-- Predictions: a 🔮 post type, separate from comments. Hidden from everyone
-- but their author until self-resolved (✅ correct / ❌ incorrect /
-- 🤷 unclear), then subject to the same per-chapter lock as comments.
-- Tamper-proof (text/chapter can't be edited after posting) and the
-- verdict is locked once set -- both enforced by a guard trigger, not just
-- RLS, since "you can update your own row" can't by itself express "but
-- not the fields that matter" or "only while a given column is still
-- null". Not available while rereading (enforced at insert time).
--
-- No visibility gotcha here (unlike comment flagging in 0014): resolving a
-- prediction only ever *adds* visibility for others, and the author can
-- always see their own row regardless of verdict -- so a plain RLS UPDATE
-- policy is enough, no SECURITY DEFINER RPC required.

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  verdict text check (verdict in ('correct', 'incorrect', 'unclear')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.predictions enable row level security;

create policy "predictions are visible to their author, or once resolved and unlocked"
  on public.predictions for select
  to authenticated
  using (
    exists (
      select 1 from public.books
      where books.id = predictions.book_id and public.is_group_member(books.group_id)
    )
    and (
      user_id = auth.uid()
      or (verdict is not null and public.is_chapter_unlocked(auth.uid(), book_id, chapter_id))
    )
  );

-- Same "can't post ahead of your own position" rule as comments, plus:
-- rereaders can't create predictions at all (they already know the
-- outcome -- see SPEC's Reread Mode section).
create policy "members can post a prediction up to their position, not while rereading"
  on public.predictions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.books
      where books.id = predictions.book_id and public.is_group_member(books.group_id)
    )
    and public.is_chapter_unlocked(auth.uid(), book_id, chapter_id)
    and not exists (
      select 1 from public.shelf_entries se
      where se.book_id = predictions.book_id
        and se.user_id = auth.uid()
        and se.is_rereading
    )
  );

-- The guard trigger below is what actually enforces "only the verdict
-- column, only once" -- this policy just gates the update to the author.
create policy "authors can self-resolve their own prediction"
  on public.predictions for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Deleting is only offered as a "never mind, misclick" affordance before
-- anyone (including the scoreboard) has seen the outcome -- once resolved,
-- the record is kept for the scoreboard's integrity.
create policy "authors can delete their own unresolved prediction"
  on public.predictions for delete
  to authenticated
  using (user_id = auth.uid() and verdict is null);

create function public.guard_prediction_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.book_id is distinct from old.book_id
     or new.chapter_id is distinct from old.chapter_id
     or new.body is distinct from old.body
     or new.user_id is distinct from old.user_id then
    raise exception 'Predictions are tamper-proof: text and chapter can''t change after posting';
  end if;

  if old.verdict is not null and new.verdict is distinct from old.verdict then
    raise exception 'A prediction''s verdict is locked once set';
  end if;

  if new.verdict is not null and old.verdict is null then
    new.resolved_at = now();
  end if;

  return new;
end;
$$;

create trigger guard_prediction_update
  before update on public.predictions
  for each row execute function public.guard_prediction_immutability();

-- Visible only after finishing (has_full_access), independent of whether
-- every chapter happens to already be individually unlocked by position --
-- deliberately stricter than per-row visibility, so comparing scores isn't
-- itself a pacing/plot-intensity signal to someone still reading. Only
-- counts resolved predictions; an empty result for a non-full-access
-- caller is the enforcement, not just a client-side hint.
create function public.prediction_scoreboard(p_book_id uuid)
returns table (
  user_id uuid,
  display_name text,
  correct bigint,
  incorrect bigint,
  unclear bigint,
  total bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.user_id,
    pr.display_name,
    count(*) filter (where p.verdict = 'correct') as correct,
    count(*) filter (where p.verdict = 'incorrect') as incorrect,
    count(*) filter (where p.verdict = 'unclear') as unclear,
    count(*) as total
  from public.predictions p
  join public.profiles pr on pr.id = p.user_id
  where p.book_id = p_book_id
    and p.verdict is not null
    and public.has_full_access(auth.uid(), p_book_id)
  group by p.user_id, pr.display_name
  order by correct desc, total desc;
$$;

create index predictions_book_chapter_idx on public.predictions (book_id, chapter_id);

-- Trigger-only function: nobody should call it directly via PostgREST.
revoke execute on function public.guard_prediction_immutability() from public, anon, authenticated;
-- prediction_scoreboard is meant to be called by authenticated clients,
-- just not anonymously -- same shape as locked_comment_count.
revoke execute on function public.prediction_scoreboard(uuid) from public, anon;
