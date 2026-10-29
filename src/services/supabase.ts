import { createClient } from '@supabase/supabase-js'
import { getSupabaseConfigurationStatus } from '../config/supabase'

export { getSupabaseConfigurationStatus } from '../config/supabase'
export type { SupabaseConfigurationStatus } from '../config/supabase'

const { enabled, url, anonKey } = getSupabaseConfigurationStatus()

export const isSupabaseConfigured = enabled

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null
