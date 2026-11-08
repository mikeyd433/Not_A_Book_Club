import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env'
import type { Database } from '@/types/database'

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[NABC] Supabase env vars missing. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.local (see .env.example).',
  )
}

// The Supabase project is a shared database for several apps (one login
// across all of them). NABC's tables and RPCs live in the `nabc` schema;
// `public` holds only what's shared (profiles — exposed to this client as
// the nabc.profiles view). See migrations 0059/0060 and SPEC.md.
export const supabase = createClient<Database, 'nabc'>(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY || 'public-anon-key',
  { db: { schema: 'nabc' } },
)
