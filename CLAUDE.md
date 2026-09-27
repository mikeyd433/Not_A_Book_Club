# Not A Book Club (NABC)

**Read `SPEC.md` first** — it's the full product spec plus a running status
section (what's built, what's not, conventions, and a real Postgres/RLS
gotcha worth knowing before touching comment moderation). This file is just
the quick orientation.

## Dev setup

```bash
pnpm install
cp .env.example .env.local   # already has real Supabase project values checked in
pnpm dev                     # serves at /nabc (matches the production base path)
```

Supabase project ref: `dpflpwoivvpfvainzwgd`. Use the Supabase MCP tools
(`apply_migration`, `execute_sql`, `generate_typescript_types`,
`get_advisors`) against that project id — migrations in
`supabase/migrations/` are the source of truth and are applied there
directly, not via a local Supabase CLI stack.

## Where this deploys

This repo is fetched and built by `mikeyd433/dabingabongo`'s `build.sh` and
served at `dabingabongo.com/nabc` — see SPEC.md's Project Status section
for the branch name and details.

## Working branch

`claude/confident-cray-qvmr29` — push there unless told otherwise.
