import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
function bytes(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)) }
function encoded(value: Uint8Array) { return btoa(String.fromCharCode(...value)) }
async function key() { const value = Deno.env.get('PROVIDER_ENCRYPTION_KEY'); if (!value) throw new Error('Provider encryption is not configured.'); return crypto.subtle.importKey('raw', bytes(value), 'AES-GCM', false, ['encrypt']) }
async function encrypt(value: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(value)); return { encryptedToken: encoded(new Uint8Array(encrypted)), tokenIv: encoded(iv) } }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
async function validate(projectId: string, token: string) { const result = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${encodeURIComponent(projectId)}`, { headers: { Authorization: `Bearer ${token}` } }); if (!result.ok) throw new Error('Firebase rejected the request. Check the project ID and access token.'); return result.json() }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase function secrets are not configured.')
    if (!authorization) return response({ error: 'Sign in is required.' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } }); const { data: { user }, error: authError } = await userClient.auth.getUser(); if (authError || !user) return response({ error: 'The current session is invalid.' }, 401)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); const body = await request.json(); const action = String(body.action ?? '')
    const { data: connection } = await admin.from('provider_connections').select('account_id, last_synced_at').eq('owner_id', user.id).eq('provider', 'firebase').maybeSingle()
    if (action === 'status') return response({ connected: Boolean(connection), projectId: connection?.account_id ?? null, lastSyncedAt: connection?.last_synced_at ?? null })
    if (action === 'connect') {
      const projectId = String(body.projectId ?? '').trim(); const accessToken = String(body.accessToken ?? '').trim(); if (!projectId || !accessToken) return response({ error: 'Enter a Firebase project ID and Google access token.' }, 400)
      await validate(projectId, accessToken); const encrypted = await encrypt(JSON.stringify({ accessToken })); const { error } = await admin.from('provider_connections').upsert({ owner_id: user.id, provider: 'firebase', account_id: projectId, encrypted_token: encrypted.encryptedToken, token_iv: encrypted.tokenIv, connected_at: new Date().toISOString() }, { onConflict: 'owner_id,provider' }); if (error) throw new Error('Unable to securely save the Firebase connection.')
      return response({ connected: true, projectId })
    }
    return response({ error: 'Firebase usage metrics require a project-specific Google Cloud Monitoring configuration.' }, 501)
  } catch (error) { return response({ error: error instanceof Error ? error.message : 'Firebase operation failed.' }, 500) }
})
