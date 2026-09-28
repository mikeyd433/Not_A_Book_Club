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
directly, not via a local Supabase CLI stack. Same for the Edge Functions
(`supabase/functions/send-push/`, `supabase/functions/search-gifs/`) —
deploy with the `deploy_edge_function` MCP tool, not the Supabase CLI.
Secrets they need (VAPID keys, a dispatch shared secret, the Giphy API
key) live in Supabase Vault, not Postgres/Netlify env vars — see SPEC.md's
Push Notifications and GIF Attachments bullets for why and how to
read/rotate them (`select * from vault.decrypted_secrets` as the Postgres
owner role, or `public.get_app_secret(name)`). The Giphy key is a real one
from the project owner's own developer account (100 req/hour free tier) —
if it ever needs rotating, `select vault.update_secret(id, new_value,
'giphy_api_key')` using the id from `select id from vault.secrets where
name = 'giphy_api_key'`.

## Where this deploys

This repo is fetched and built by `mikeyd433/dabingabongo`'s `build.sh` and
served at `dabingabongo.com/nabc` — see SPEC.md's Project Status section
for the branch name and details.

## Working branch

`claude/magical-sagan-9pmk6q` — push there unless told otherwise.
