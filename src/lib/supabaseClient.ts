import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types.ts'

const supabaseKey = import.meta.env.VITE_SUPABASE_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)
