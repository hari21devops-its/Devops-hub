import { afterEach, describe, expect, it, vi } from 'vitest'

import { getSupabaseConfigurationStatus } from './supabase'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('supabase configuration', () => {
  it('reports disabled status when env variables are missing', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    const status = getSupabaseConfigurationStatus()

    expect(status.enabled).toBe(false)
    expect(status.url).toBe('')
    expect(status.anonKey).toBe('')
  })
})
