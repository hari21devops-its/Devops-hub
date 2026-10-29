import postgres from 'npm:postgres'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
function bytes(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)) }
function encoded(value: Uint8Array) { return btoa(String.fromCharCode(...value)) }
async function key() { const value = Deno.env.get('PROVIDER_ENCRYPTION_KEY'); if (!value) throw new Error('Provider encryption is not configured.'); return crypto.subtle.importKey('raw', bytes(value), 'AES-GCM', false, ['encrypt', 'decrypt']) }
async function encrypt(value: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(value)); return { encryptedToken: encoded(new Uint8Array(encrypted)), tokenIv: encoded(iv) } }
async function decrypt(ciphertext: string, iv: string) { const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await key(), bytes(ciphertext)); return new TextDecoder().decode(plain) }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }

async function databaseSize(connectionString: string) {
  const sql = postgres(connectionString, { ssl: 'require', max: 1, idle_timeout: 5, connect_timeout: 10 })
  try { const rows = await sql`select pg_database_size(current_database())::bigint as bytes`; return Number(rows[0]?.bytes ?? 0) }
  finally { await sql.end({ timeout: 5 }) }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase function secrets are not configured.')
    if (!authorization) return response({ error: 'Sign in is required.' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } }); const { data: { user }, error: authError } = await userClient.auth.getUser(); if (authError || !user) return response({ error: 'The current session is invalid.' }, 401)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); const body = await request.json(); const action = String(body.action ?? '')
    const { data: connection } = await admin.from('provider_connections').select('account_id, encrypted_token, token_iv, last_synced_at').eq('owner_id', user.id).eq('provider', 'supabase').maybeSingle()
    if (action === 'status') return response({ connected: Boolean(connection), projectRef: connection?.account_id ?? null, lastSyncedAt: connection?.last_synced_at ?? null })
    if (action === 'connect') {
      const projectRef = String(body.projectRef ?? '').trim(); const databaseUrl = String(body.databaseUrl ?? '').trim()
      if (!/^[a-z0-9]{20}$/.test(projectRef) || !databaseUrl.startsWith('postgres')) return response({ error: 'Enter a valid Supabase project ref and PostgreSQL connection URL.' }, 400)
      await databaseSize(databaseUrl); const encrypted = await encrypt(databaseUrl)
      const { error } = await admin.from('provider_connections').upsert({ owner_id: user.id, provider: 'supabase', account_id: projectRef, encrypted_token: encrypted.encryptedToken, token_iv: encrypted.tokenIv, connected_at: new Date().toISOString() }, { onConflict: 'owner_id,provider' })
      if (error) throw new Error('Unable to securely save the Supabase connection.')
      return response({ connected: true, projectRef })
    }
    if (action === 'sync') {
      const projectId = String(body.projectId ?? '').trim(); if (!projectId || !connection) return response({ error: 'Choose a project and connect Supabase before syncing.' }, 400)
      const { data: project } = await admin.from('projects').select('id').eq('id', projectId).eq('owner_id', user.id).maybeSingle(); if (!project) return response({ error: 'Project not found for this account.' }, 404)
      const databaseUrl = await decrypt(String(connection.encrypted_token), String(connection.token_iv)); const size = await databaseSize(databaseUrl); const syncedAt = new Date().toISOString()
      const { error: integrationError } = await admin.from('project_integrations').upsert({ project_id: projectId, provider: 'Supabase', resource_type: 'database', resource_id: connection.account_id, resource_name: `Supabase ${connection.account_id}`, connection_status: 'Connected', last_synced_at: syncedAt }, { onConflict: 'project_id,provider,resource_id' })
      if (integrationError) throw new Error('Supabase usage was fetched, but the project resource association could not be saved.')
      await admin.from('provider_usage_snapshots').delete().eq('project_id', projectId).eq('provider', 'Supabase')
      const { error } = await admin.from('provider_usage_snapshots').insert({ project_id: projectId, provider: 'Supabase', metric: 'database_storage', value: size, unit: 'bytes', synced_at: syncedAt })
      if (error) throw new Error('Supabase usage was fetched, but the snapshot could not be saved.')
      await admin.from('provider_connections').update({ last_synced_at: syncedAt }).eq('owner_id', user.id).eq('provider', 'supabase')
      return response({ imported: 1, bytes: size, projectRef: connection.account_id })
    }
    return response({ error: 'Unsupported action.' }, 400)
  } catch (error) { return response({ error: error instanceof Error ? error.message : 'Supabase usage operation failed.' }, 500) }
})
