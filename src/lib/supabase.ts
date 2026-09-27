import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './env'
import type { Database } from '@/types/database'

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[NABC] Supabase env vars missing. Set VITE_SUPABASE_URL and ' +
      'VITE_SUPABASE_ANON_KEY in .env.local (see .env.example).',
  )
}

export const supabase = createClient<Database>(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY || 'public-anon-key',
)
