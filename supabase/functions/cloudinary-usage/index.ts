import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }

function bytes(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)) }
function encoded(value: Uint8Array) { return btoa(String.fromCharCode(...value)) }
async function key() {
  const value = Deno.env.get('PROVIDER_ENCRYPTION_KEY')
  if (!value) throw new Error('Provider encryption is not configured.')
  return crypto.subtle.importKey('raw', bytes(value), 'AES-GCM', false, ['encrypt', 'decrypt'])
}
async function encrypt(value: string) {
  const encryptionKey = await key()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, new TextEncoder().encode(value))
  return { encryptedToken: encoded(new Uint8Array(encrypted)), tokenIv: encoded(iv) }
}
async function decrypt(ciphertext: string, iv: string) {
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await key(), bytes(ciphertext))
  return new TextDecoder().decode(plaintext)
}
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
async function usage(cloudName: string, apiKey: string, apiSecret: string) {
  const authorization = btoa(`${apiKey}:${apiSecret}`)
  const result = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/usage`, { headers: { Authorization: `Basic ${authorization}` } })
  const payload = await result.json()
  if (!result.ok) throw new Error('Cloudinary rejected the request. Check the cloud name and API credentials.')
  return payload as Record<string, unknown>
}
function numeric(payload: Record<string, unknown>, keyName: string) {
  const value = payload[keyName]
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'usage' in value) return Number((value as { usage?: unknown }).usage ?? 0)
  return 0
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase function secrets are not configured.')
    if (!authorization) return response({ error: 'Sign in is required.' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return response({ error: 'The current session is invalid.' }, 401)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const body = await request.json()
    const action = String(body.action ?? '')
    const { data: connection } = await admin.from('provider_connections').select('account_id, encrypted_token, token_iv, last_synced_at').eq('owner_id', user.id).eq('provider', 'cloudinary').maybeSingle()

    if (action === 'status') return response({ connected: Boolean(connection), cloudName: connection?.account_id ?? null, lastSyncedAt: connection?.last_synced_at ?? null })
    if (action === 'connect') {
      const cloudName = String(body.cloudName ?? '').trim()
      const apiKey = String(body.apiKey ?? '').trim()
      const apiSecret = String(body.apiSecret ?? '').trim()
      if (!cloudName || !apiKey || !apiSecret) return response({ error: 'Enter the Cloudinary cloud name, API key, and API secret.' }, 400)
      await usage(cloudName, apiKey, apiSecret)
      const encrypted = await encrypt(`${apiKey}:${apiSecret}`)
      const { error } = await admin.from('provider_connections').upsert({ owner_id: user.id, provider: 'cloudinary', account_id: cloudName, encrypted_token: encrypted.encryptedToken, token_iv: encrypted.tokenIv, connected_at: new Date().toISOString() }, { onConflict: 'owner_id,provider' })
      if (error) throw new Error('Unable to securely save the Cloudinary connection.')
      return response({ connected: true, cloudName })
    }
    if (action === 'sync') {
      const projectId = String(body.projectId ?? '').trim()
      if (!projectId || !connection) return response({ error: 'Choose a project and connect Cloudinary before syncing.' }, 400)
      const { data: project } = await admin.from('projects').select('id').eq('id', projectId).eq('owner_id', user.id).maybeSingle()
      if (!project) return response({ error: 'Project not found for this account.' }, 404)
      const credentials = await decrypt(String(connection.encrypted_token), String(connection.token_iv))
      const separator = credentials.indexOf(':')
      const payload = await usage(String(connection.account_id), credentials.slice(0, separator), credentials.slice(separator + 1))
      const syncedAt = new Date().toISOString()
      const metrics = [
        { metric: 'bandwidth', value: numeric(payload, 'bandwidth'), unit: 'bytes' },
        { metric: 'storage', value: numeric(payload, 'storage'), unit: 'bytes' },
        { metric: 'transformations', value: numeric(payload, 'transformations'), unit: 'requests' },
      ]
      await admin.from('provider_usage_snapshots').delete().eq('project_id', projectId).eq('provider', 'Cloudinary')
      const { error } = await admin.from('provider_usage_snapshots').insert(metrics.map((item) => ({ project_id: projectId, provider: 'Cloudinary', metric: item.metric, value: item.value, unit: item.unit, synced_at: syncedAt })))
      if (error) throw new Error('Cloudinary usage was fetched, but snapshots could not be saved.')
      await admin.from('provider_connections').update({ last_synced_at: syncedAt }).eq('owner_id', user.id).eq('provider', 'cloudinary')
      return response({ imported: metrics.length, cloudName: connection.account_id })
    }
    return response({ error: 'Unsupported action.' }, 400)
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'Cloudinary operation failed.' }, 500)
  }
})
