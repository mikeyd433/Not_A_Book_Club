# Not A Book Club (NABC) — Project Spec & Status

**Working title:** Not A Book Club, or **NABC** for short

This file is both the living product spec and a handoff doc — read it at
the start of a new session to pick up where things left off.

## Overview

A private web app for a small friend group to read books at their own pace
and discuss them without spoilers. Each person tracks their own books and
progress. Every book has a forum-style thread where comments are tagged to
chapters, and anything past a reader's current chapter is hidden until they
get there.

**Core problem:** friends can't meet on a schedule or read at the same pace.
**Core solution:** asynchronous, chapter-locked discussion.

---

## Project Status (read this first)

### Stack — as actually built (differs from the original "Suggested Stack" below)

- **Frontend:** Vite + React + TypeScript + Tailwind, **not** Next.js. The
  app deploys as a static PWA at `/nabc` inside an existing personal site
  (`dabingabongo.com`), which is a Netlify site aggregating several
  unrelated static SPAs (Stroke Off, The Delve, etc.) — none of them run a
  Node server, so Next's SSR/API routes didn't fit. Everything the spec
  needs is doable client-side against Supabase directly.
- **Backend:** Supabase — Postgres + RLS, Auth (magic link), Storage.
  - Project ref: `dpflpwoivvpfvainzwgd` (org "The Jackie Chan Fan Club",
    region us-east-1). Get URL/keys with the Supabase MCP tools
    (`get_project_url`, `get_publishable_keys`) or from `.env.example`.
- **Repos:**
  - `mikeyd433/Not_A_Book_Club` — this repo, the app itself. Working
    branch: `claude/magical-sagan-9pmk6q`.
  - `mikeyd433/dabingabongo` (aka `Dabingabongo`) — the personal site that
    serves this app at `/nabc`. Branch `add-nabc-integration` (not yet
    merged to `main` as of this writing) adds a build.sh block that clones
    this repo fresh on every site build, runs `pnpm build`, and copies the
    output into `dist/nabc` — the same pattern the site already uses for
    another vendored app ("The Delve"). See that repo's `build.sh` and
    `netlify.toml` for the exact wiring, including the
    `NABC_SUPABASE_URL` / `NABC_SUPABASE_ANON_KEY` Netlify env vars it
    needs (distinct from the site's other apps' own Supabase projects).
- **Book data:** Open Library API (`src/lib/openLibrary.ts`) — search +
  covers, no API key needed.
- **GIFs:** not wired up yet (Giphy/Tenor from the original suggested stack
  — deferred along with attachments generally, see below).

### What's built (foundation + two feature passes so far)

- **Auth & groups:** magic-link login, invite-code join/create-group flow,
  admin role, member list with promote-to-admin.
- **Books & shelves:** Open Library search + manual add, all six shelf
  statuses, per-user shelf entries, home screen with progress bars,
  wheel-style chapter picker (drum/iOS-time-picker style, `ChapterWheelPicker`).
- **Chapters:** ordered list keyed by `chapter_id` (not position) so
  inserting a prologue doesn't break existing comments/progress. Quick
  fill, bulk paste from TOC, insert-before, rename, remove, full edit
  history with revert (`ChaptersEditor.tsx`). Editable by anyone currently
  reading the book.
- **Covers:** camera/photo-library/URL upload → client-side crop-and-rotate
  to ~2:3 (canvas-based, `src/lib/image.ts` + `CoverCropper.tsx`, no
  external cropping library) → gallery (`CoverGallery.tsx`) with per-cover
  delete (own non-default, or admin for any), personal override per reader,
  admin-only default-cover changes after the first upload. Accent color is
  sampled from whichever cover is the group default and themes the book's
  pages (`BookLayout.tsx` sets `--color-accent`/`--color-accent-contrast`).
- **Discussion:** one thread per book, chapter-order/newest/recently-unlocked
  sort (remembered per user per book), nested replies, reread badge
  placeholder. **Reactions** (fixed emoji palette, toggle on tap). **Flag as
  spoiler** (anyone can flag; hidden from everyone but the author/admin
  until resolved — see the RLS gotcha below). **No-spoilers-please tag**
  (caps replies to the asker's own chapter position). **Inline spoiler
  blocks** (Discord-`||spoiler||`-style, but composed via an "Insert
  spoiler" button rather than typed markup, each block independently
  chapter-tagged and fully invisible server-side until unlocked, then
  tap-to-reveal).
- **The spoiler lock rule itself** (the core mechanic) is enforced in
  Postgres RLS, not just the client — `is_chapter_unlocked()` /
  `has_full_access()` in `0004_shelf_entries.sql`, reused everywhere
  (comments, reactions, spoiler_blocks). A `locked_comment_count()` RPC
  reports "N comments ahead" without leaking which chapter they're at.
  This was verified end-to-end multiple times against the live database
  with seeded throwaway accounts (create two users, advance one's chapter
  position, confirm the other can't see/react to/post ahead of locked
  content, confirm it unlocks at the right threshold) — not just unit-level
  reasoning about the policy SQL.
- **Reread mode:** "Start a reread"/"Finish reread" on `BookDetail.tsx` for
  a Finished book, fresh chapter-lock position, "view full thread anyway"
  toggle (reuses `spoil_me`), 🔁 badge on comments posted during a reread.
  See the Reread Mode feature section below for the RLS details.
- **Predictions:** a separate `/book/:id/predictions` page (`Predictions.tsx`),
  new `predictions` table. Hidden from everyone but the author until
  self-resolved (✅/❌/🤷); tamper-proof (body/chapter immutable, verdict
  locked once set) via a `before update` guard trigger rather than RLS
  alone, since RLS can't express "only this column, only while it's still
  null." Not available while rereading (blocked at insert, same as the
  Reread Mode section says). Per-book scoreboard (`prediction_scoreboard()`
  RPC) aggregates resolved predictions per reader, gated on
  `has_full_access()` server-side -- deliberately stricter than per-row
  chapter-unlock, so comparing scores can't itself be a pacing/plot-intensity
  signal to someone still reading. Verified against the live DB the same
  way as the reread-mode RLS change: unresolved hidden from a second
  member, visible once resolved and unlocked, verdict/body immutability
  enforced by the trigger, insert blocked for a rereader, scoreboard empty
  without full access and populated with it.
- **Finishing Extras:** a separate `/book/:id/reviews` page (`Reviews.tsx`),
  new `ratings` table (stars 1-5 + optional review text). One row per
  "attempt" rather than a column on `shelf_entries`, so a reread can add a
  fresh rating (`is_reread`) without overwriting the original -- that's the
  spec's "reread rating history". `is_dnf` mirrors shelf status at rating
  time so the group average can exclude DNF ratings ("DNF handled
  separately") without joining back to a `shelf_entries` row whose status
  keeps changing. No guard trigger here (unlike predictions) -- a personal
  opinion isn't a competitive/tamper-proof mechanic, so plain owner-scoped
  update/delete is enough. Both read and write are gated on
  `has_full_access()` alone (not per-chapter unlock), same reasoning as the
  prediction scoreboard -- "Reviews, locked until finished" holds on both
  ends. The chapter reaction heatmap and the prediction scoreboard being
  visible "after finishing" needed no new RPC: a full-access reader's
  existing comments/reactions query already returns everything unfiltered
  (`is_chapter_unlocked()` already resolves true once `has_full_access()`
  does), so the heatmap is computed client-side from data already fetched
  for the Discussion page, gated on the same `fullAccess` check used
  everywhere else on this page. "DNF with Spoil me unlocks all of the
  above" falls out for free, since `has_full_access()` already includes
  that case. Verified against the live DB with seeded accounts: a reader
  without full access is rejected on insert; a full-access reader's own
  rating is visible to them immediately; a second, still-reading member
  can't see it until they too reach full access.
- **Mobile formatting** is a standing cross-cutting requirement (not in the
  original spec, added later): every `<input>`/`<select>`/`<textarea>` is
  16px+ (prevents iOS Safari auto-zoom on focus), every tappable control
  meets a ~44px touch target, the header is sticky and the bottom nav
  respects `env(safe-area-inset-*)`, long text truncates/wraps instead of
  overflowing. Apply this to everything built from here on, not just what's
  already been checked.

### Not built yet

Roughly in spec order:
- **Achievements** (participation-based, hidden ones, `achievements_earned`
  table).
- **Push notifications** (per-book mute, quiet hours with batching — the
  onboarding flow's "allow notifications" step, and `group_members.
  notification_prefs`, are schema-ready but nothing sends anything yet;
  needs a Supabase Edge Function + web push).
- **Style polish:** confetti/celebration moments on unlock/achievement are
  not implemented.
- Photo/GIF attachments on comments (only text + inline spoiler blocks
  exist; the spec's "Content: text, photos, and GIFs" is partially done).

### A real Postgres/RLS gotcha worth knowing before touching comment moderation

Postgres requires that whoever performs an `UPDATE` can still `SELECT` the
row afterward under the table's own SELECT policy — **even when the UPDATE
policy's own `WITH CHECK` is unconditionally `true`**. "Anyone can flag a
comment, and it becomes invisible to everyone but the author/admin" is
*designed* to remove the flagger's own visibility (unless they're the
author or an admin) — so no plain RLS UPDATE policy can implement it; a
non-admin flagger's write gets rejected no matter what the policy says,
solely because the resulting row would be invisible to them. This is easy
to mistake for a bug in the policy logic (it looks and smells like one —
took a long debugging session to actually pin down, including confirming
it with a literal `USING (true) WITH CHECK (true)` policy that *still*
failed in exactly the cases where visibility would be lost, and succeeded
in the cases where it wouldn't, e.g. an admin flagging someone else's
comment). **The fix, and the pattern to reuse for anything similar:** do
the write inside a `SECURITY DEFINER` RPC function that checks
authorization manually in SQL and then updates the row directly, bypassing
the caller's own RLS-constrained UPDATE path entirely. See
`flag_comment()` / `resolve_comment_flag()` in `0014_flag_rpcs.sql`, same
family as `create_group()` / `join_group_by_code()` / `set_default_cover()`.
If a future feature needs "user A can put user B's row into a state where
A can no longer see it," reach for this pattern immediately rather than
debugging a "broken" RLS policy for an hour.

Also worth knowing: **every new Postgres function grants `EXECUTE` to the
`PUBLIC` pseudo-role by default.** Revoking from a named role like `anon`
alone is a no-op if `anon` was only ever inheriting via that implicit
`PUBLIC` grant — always `revoke ... from public, anon` (or `public, anon,
authenticated` for trigger-only functions nothing should call directly).
Missed this once (`0014`), caught it via `get_advisors` and fixed in
`0016`.

### Conventions established so far

- Migrations are numbered sequentially in `supabase/migrations/`, one
  logical change per file, applied via the Supabase MCP tools
  (`apply_migration`), never hand-edited after the fact — a mistake gets a
  new follow-up migration (see `0006`, `0009` fixing `0001`/earlier;
  `0016` fixing `0014`), same spirit as not rewriting git history.
- Every table ships with RLS enabled and policies in the same migration
  that creates it.
- `src/types/database.ts` is generated (Supabase MCP
  `generate_typescript_types`) and hand-merged back in with the two small
  custom helper types (`Tables<>`, `TablesInsert<>`, `TablesUpdate<>`) kept
  at the bottom — regenerate and re-merge after schema changes rather than
  hand-editing the generated part.
- Data-fetching hooks live in `src/lib/<domain>/queries.ts` (books, covers,
  comments, group), each a thin React Query wrapper over a Supabase call —
  no separate service/repository layer.
- Foreign keys that need to be embedded in a PostgREST `select()` (e.g.
  `profiles(display_name)`) must point at `public.profiles`, not
  `auth.users` — PostgREST can't infer a join between two tables that both
  merely reference a third. See `0008_fk_to_profiles.sql`.
- RLS verification for anything security-sensitive is done by seeding
  throwaway `auth.users`/profiles/groups directly via SQL (`execute_sql`),
  impersonating each one with `set local role authenticated; set local
  request.jwt.claims = '{"sub":"...","role":"authenticated"}';`, and then
  actually attempting the operation — not just reading the policy SQL and
  reasoning about it. Clean up the seeded rows afterward (delete the
  `books`/`groups` rows, which cascade; delete the `auth.users` rows, which
  cascade to `profiles`). This is how the flagging bug above was actually
  caught and confirmed fixed.

---

## Suggested Stack (original)

- **Backend:** Supabase (Postgres, Auth, Storage, Row Level Security)
- **Auth:** magic-link email login
- **Frontend:** installable PWA with push notifications (iOS requires Add to Home Screen)
- **Book data:** Open Library API (metadata and covers)
- **GIFs:** Giphy or Tenor API

Include a `group_id` on all group-scoped tables from day one. The app ships with one group but should support multiple groups later without a migration.

---

## Features

### Group and Accounts — mostly done
- One private, invite-only group (invite link or code) — **done**
- Magic-link login, no passwords — **done**
- Admin role: the group creator is admin and can promote others — **done**
- Push notifications, with per-book mute and quiet hours (notifications during quiet hours are batched and delivered afterward, not dropped) — **not built**
- Onboarding flow:
  1. Open the invite link, then log in with email — **done**
  2. "Add to Home Screen" prompt, with iPhone-specific steps — **not built**
  3. Allow notifications — **not built**
  4. Add current books and set progress — **done**
  5. Optionally add "read before joining" books — **done** (shelf status exists; no dedicated onboarding step)
  6. Land on the home screen — **done**

### Books and Shelves — done
- Shelf statuses: Reading now, Paused, Finished, DNF, Read before joining, Want to read — **done**
- Pause keeps your position; resuming restores it — **done** (position lives on the shelf entry regardless of status)
- Book metadata comes from Open Library — **done**
- Home screen shows your current books, each with a progress bar, unlocked-comment count, and quick progress update — **done**
- Everyone can see everyone's progress — **done**

### Reread Mode — mostly done
- "Start reread" gives you a fresh reading position; your original Finished status and review are kept — **done** (status stays `finished`; `is_rereading=true` + `current_chapter_id` reset to null on start, in `BookDetail.tsx`)
- Locks apply as if it's your first read, with a toggle to view the full thread — **done**. `has_full_access()` (`0017_reread_mode.sql`) no longer treats `status = 'finished'` as an unconditional grant when `is_rereading` is true; it falls through to the normal position-based check unless `spoil_me` is on. `spoil_me` is repurposed as the "view full thread anyway" toggle during a reread (same column, condition-dependent label in the UI) — reused rather than adding a new column since the semantics ("unlock full access anyway") already matched. Verified against the live DB with seeded accounts the same way the original flagging bug was (reread + spoil_me off → chapter ahead of position stays locked; spoil_me on → unlocks; a `finished`-but-not-rereading reader is unaffected).
- Comments made during a reread show a 🔁 badge — **done**, `usePostComment` now takes `madeDuringReread` and `Thread.tsx` passes `myEntry.is_rereading` on every post/reply
- Rereaders cannot create predictions — **n/a for now**: predictions aren't built yet; revisit when they are
- When you finish a reread, you can optionally update your rating (see Finishing Extras) — **n/a for now**: ratings aren't built yet ("Finish reread" just flips `is_rereading` back off); revisit when Finishing Extras lands

### Covers — done
- Anyone can upload multiple covers per book (camera, photo library, or image URL) — **done**
- Crop and rotate on upload, standardized to about 2:3 — **done**
- **Group default cover** is set once:
  1. The adder's chosen cover, otherwise
  2. The first uploaded cover, otherwise
  3. The Open Library cover, otherwise
  4. A generated placeholder (the title on the book's accent color)
  — **done** (1 and 2 collapse to "first cover row inserted," which a trigger handles; 3/4 handled client-side in `CoverThumb`)
- After that, only an admin can change the default. The adder uploading later or leaving the group changes nothing. — **done**
- **Personal override:** each reader can pick any gallery cover for their own shelf — **done**
- Uploads persist if the uploader leaves the group — **done** (`covers.uploaded_by` is nullable, `on delete set null`)
- Uploaders can delete their own covers, except the current default (admin only) — **done**
- Each book's accent color is pulled from the displayed cover — **done** (average-color sample, not a full palette-extraction algorithm — good enough, not spec-mandated to be more sophisticated)

### Chapters and Progress — done
- Each book has an ordered chapter list, with hidden `position`, editable `label`, optional `part_label` — **done**
- Editing tools: quick fill, insert/remove, rename, bulk paste from TOC — **done**
- Anyone currently reading the book can edit the chapter list — **done**
- Chapter edit history, with revert — **done**
- Group notice when a chapter list changes — **not built** (no notification system yet)
- Comments and progress reference `chapter_id`, not position — **done**
- Progress updated with a vertical wheel picker — **done**

### Discussion — mostly done
- One thread per book — **done**
- Every comment tagged to a chosen chapter, capped at the poster's own position — **done**
- Replies default to parent's chapter, retaggable to later (locks separately) — **done**
- Content: text — **done**; photos and GIFs — **not built**
- Sort options (chapter/newest/recently-unlocked/most-reactions), remembered per user per book — **done**, except "most reactions" isn't in the UI yet (schema-ready, `sort_pref` check constraint already allows it)
- Non-chapter sorts show a small chapter tag instead of headers — **done**
- Replies stay nested under their parent in every sort — **done**
- No-spoilers tag — **done**

### Spoiler Protection — mostly done
- Lock rule enforced server-side (RLS), not just the client — **done**, see the RLS gotcha section above
- Locked items appear collapsed with a per-item message ("🔒 Comment at Ch. 14…") — **not done this way**: locked rows are fully hidden by RLS (can't reveal a specific chapter number without leaking pacing info through a side channel), so instead there's an aggregate "🔒 N comments ahead" count. Worth revisiting if the per-item collapsed message is actually wanted — it would need a redesign (e.g. a separate metadata-only view/RPC that exposes just the chapter number, not content).
- Sorting only applies to unlocked items; locked items collapsed at the bottom — **partially**: since locked items aren't sent to the client at all, there's nothing to sort into "collapsed at the bottom" — moot given the design above.
- Updating progress unlocks content, with a notice — **partially**: content unlocks correctly; no "X new comments unlocked" toast/notice yet.
- Full access: Finished, Read before joining, or DNF with "Spoil me" — **done**
- Inline spoiler blocks — **done**
- Flag as spoiler — **done**

### Predictions — done
- 🔮 post type, hidden by default, tamper-proof, self-resolved (✅/❌/🤷), locked verdict, scoreboard after finishing, not available in reread mode — **done**, see the Predictions bullet under Project Status above for the RLS/trigger details. `Predictions.tsx` + `src/lib/predictions/queries.ts`.

### Finishing Extras — done
- Star ratings with group average, DNF handled separately, reread rating history — **done**, see the Finishing Extras bullet under Project Status above. `Reviews.tsx` + `src/lib/ratings/queries.ts`.
- Reviews, locked until finished — **done**, same page; gated on `has_full_access()` for both reading and writing.
- Chapter reaction heatmap, visible only after finishing — **done**, computed client-side from the existing comments/reactions query, gated on the same full-access check.
- Prediction scoreboard, visible after finishing — **done**, built as part of Predictions (`prediction_scoreboard()` RPC, gated on `has_full_access()`)
- DNF with "Spoil me" unlocks all of the above — **done**, falls out of reusing `has_full_access()` everywhere in this section

### Achievements — not built
- Participation-based, never speed-based; some hidden until earned
- Shown on profiles and announced in the feed, book-specific details hidden until the viewer has finished that book
- `achievements_earned` table; computed by triggers or a daily job

### Style — partially done
- Playful and colorful — **done** (Tailwind theme, accent colors)
- Per-book accent colors pulled from covers — **done**
- A chunky, satisfying wheel picker — **done**
- Small celebrations (confetti) on unlock/achievement — **not built**

---

## Data Model (as actually built)

See `supabase/migrations/` for the authoritative, current schema — this is
a summary, and migrations are the source of truth if it ever drifts.

| Table | Notes |
|---|---|
| `profiles` | 1:1 with `auth.users`, auto-provisioned by a signup trigger |
| `groups` | `invite_code`, generated server-side |
| `group_members` | role (admin/member), `notification_prefs` jsonb (unused so far) |
| `books` | `default_cover_id`, `accent_color`, `open_library_cover_url` fallback |
| `covers` | gallery entries; `uploaded_by` nullable (`on delete set null`) |
| `chapters` | `position` (hidden, lock-relevant), `label`, `part_label` |
| `chapter_edits` | full-list snapshots for revert |
| `shelf_entries` | one per (user, book); `personal_cover_id`, `spoil_me`, `sort_pref`, `current_chapter_id` |
| `comments` | `parent_id` self-reference, `flagged`, `no_spoilers`, `made_during_reread` |
| `reactions` | (comment_id, user_id, emoji) composite PK |
| `spoiler_blocks` | (comment_id, ordinal) unique; own chapter tag per block |
| `predictions` | `verdict` null until self-resolved; `resolved_at` set by the guard trigger, not the client |
| `ratings` | one row per rating "attempt" (not a `shelf_entries` column), so a reread can add a new one and keep history; `is_dnf`/`is_reread` are point-in-time snapshots taken at rating time |

**Visibility check (implemented as `is_chapter_unlocked()` in
`0004_shelf_entries.sql`, reused everywhere):**
```
visible = reader.has_full_access
       OR chapters[item.chapter_id].position <= chapters[reader.current_chapter_id].position
```
Enforced in RLS, verified against the live database with seeded test
accounts — not just in the client.

---

## Open Decisions (Not Yet Specified)
- Comment editing rules (edited badge? can a chapter tag be moved?) — currently: authors can freely edit their own comment's body/chapter_id, no "edited" badge shown.
- What happens to comments when their chapter is deleted — currently: `ON DELETE CASCADE`, comments are silently deleted along with the chapter. Not revisited.
- Mapping for percentage-based (e-reader) progress, if supported — not addressed; progress is chapter-position-based only.

## Shelved for Later
- Polls system (group picks, theme votes, meetup scheduling, chapter polls, end-of-book awards)
- Time capsule notifications, watch party, book handoffs, prediction judges
- Multi-group support (schema-ready via `group_id`, never exercised beyond one group)
