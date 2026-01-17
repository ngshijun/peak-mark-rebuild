import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types.ts'

const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

// Extract project ref from Supabase URL for storage key
// URL format: https://<project-ref>.supabase.co
const projectRef = new URL(supabaseUrl).hostname.split('.')[0]

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

/**
 * Clear Supabase auth data from localStorage.
 *
 * This is needed when signOut() fails due to an already-invalid session
 * (e.g., user logged out from another domain). Supabase's signOut() cannot
 * clear localStorage in this case because _useSession() fails first.
 *
 * Uses the official Supabase storage key pattern: sb-<project-ref>-auth-token
 */
export function clearSupabaseAuth(): void {
  const storageKey = `sb-${projectRef}-auth-token`
  localStorage.removeItem(storageKey)
}
