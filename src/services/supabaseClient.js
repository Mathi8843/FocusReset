// ─────────────────────────────────────────────────────────────
// Supabase client singleton
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env
// ─────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[FocusReset] Supabase env vars are missing.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Persist the session in localStorage so it survives page reloads
    persistSession: true,
    // Automatically refresh the access token before it expires
    autoRefreshToken: true,
    // Detect the OAuth callback hash/query on page load
    detectSessionInUrl: true,
  },
})
