import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client for API routes (uses service key)
export function createServerSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY
  
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_KEY environment variable')
  }
  
  return createClient(supabaseUrl, serviceKey)
}