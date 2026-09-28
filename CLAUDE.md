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
directly, not via a local Supabase CLI stack. Same for the `send-push`
Edge Function (`supabase/functions/send-push/`) — deploy with the
`deploy_edge_function` MCP tool, not the Supabase CLI. Secrets it needs
(VAPID keys, a dispatch shared secret) live in Supabase Vault, not
Postgres/Netlify env vars — see SPEC.md's Push Notifications bullet for
why and how to read/rotate them (`select * from vault.decrypted_secrets`
as the Postgres owner role, or `public.get_app_secret(name)`).

## Where this deploys

This repo is fetched and built by `mikeyd433/dabingabongo`'s `build.sh` and
served at `dabingabongo.com/nabc` — see SPEC.md's Project Status section
for the branch name and details.

## Working branch

`claude/magical-sagan-9pmk6q` — push there unless told otherwise.
