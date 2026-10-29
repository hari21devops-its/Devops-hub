export type SupabaseConfigurationStatus = {
  enabled: boolean
  url: string
  anonKey: string
  missingKeys: string[]
}

export function getSupabaseConfigurationStatus(): SupabaseConfigurationStatus {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  const missingKeys: string[] = []

  if (!url) {
    missingKeys.push('VITE_SUPABASE_URL')
  }

  if (!anonKey) {
    missingKeys.push('VITE_SUPABASE_ANON_KEY')
  }

  return {
    enabled: Boolean(url && anonKey),
    url,
    anonKey,
    missingKeys,
  }
}