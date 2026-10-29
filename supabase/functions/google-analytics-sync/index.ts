import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
function bytes(value: string) { return Uint8Array.from(atob(value), (character) => character.charCodeAt(0)) }
function encoded(value: Uint8Array) { return btoa(String.fromCharCode(...value)) }
async function key() {
  const value = Deno.env.get('PROVIDER_ENCRYPTION_KEY')
  if (!value) throw new Error('Provider encryption is not configured.')
  return crypto.subtle.importKey('raw', bytes(value), 'AES-GCM', false, ['encrypt', 'decrypt'])
}
async function encrypt(value: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(value)); return { encryptedToken: encoded(new Uint8Array(encrypted)), tokenIv: encoded(iv) } }
async function decrypt(ciphertext: string, iv: string) { const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(iv) }, await key(), bytes(ciphertext)); return new TextDecoder().decode(plain) }
function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }) }
async function metadata(propertyId: string, token: string) { const result = await fetch(`https://analyticsadmin.googleapis.com/v1alpha/properties/${encodeURIComponent(propertyId)}`, { headers: { Authorization: `Bearer ${token}` } }); const payload = await result.json(); if (!result.ok) throw new Error('Google Analytics rejected the request. Check the property ID and access token.'); return payload }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL'); const anonKey = Deno.env.get('SUPABASE_ANON_KEY'); const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase function secrets are not configured.')
    if (!authorization) return response({ error: 'Sign in is required.' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } }); const { data: { user }, error: authError } = await userClient.auth.getUser(); if (authError || !user) return response({ error: 'The current session is invalid.' }, 401)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }); const body = await request.json(); const action = String(body.action ?? '')
    const { data: connection } = await admin.from('provider_connections').select('account_id, encrypted_token, token_iv, last_synced_at').eq('owner_id', user.id).eq('provider', 'google_analytics').maybeSingle()
    if (action === 'status') return response({ connected: Boolean(connection), propertyId: connection?.account_id ?? null, lastSyncedAt: connection?.last_synced_at ?? null })
    if (action === 'connect') {
      const propertyId = String(body.propertyId ?? '').trim().replace(/^properties\//, ''); const token = String(body.accessToken ?? '').trim()
      if (!/^\d+$/.test(propertyId) || !token) return response({ error: 'Enter a numeric GA4 property ID and access token.' }, 400)
      await metadata(propertyId, token); const encrypted = await encrypt(token)
      const { error } = await admin.from('provider_connections').upsert({ owner_id: user.id, provider: 'google_analytics', account_id: propertyId, encrypted_token: encrypted.encryptedToken, token_iv: encrypted.tokenIv, connected_at: new Date().toISOString() }, { onConflict: 'owner_id,provider' })
      if (error) throw new Error('Unable to securely save the Google Analytics connection.')
      return response({ connected: true, propertyId })
    }
    if (action === 'sync') {
      const projectId = String(body.projectId ?? '').trim(); if (!projectId || !connection) return response({ error: 'Choose a project and connect Google Analytics before syncing.' }, 400)
      const { data: project } = await admin.from('projects').select('id').eq('id', projectId).eq('owner_id', user.id).maybeSingle(); if (!project) return response({ error: 'Project not found for this account.' }, 404)
      const token = await decrypt(String(connection.encrypted_token), String(connection.token_iv)); const propertyId = String(connection.account_id)
      const report = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }], dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }], limit: 31 }) })
      const payload = await report.json(); if (!report.ok) throw new Error('Google Analytics report failed. Check Data API access and property permissions.')
      const { data: source } = await admin.from('analytics_sources').select('id').eq('project_id', projectId).eq('provider', 'Google Analytics').maybeSingle()
      let sourceId = source?.id
      if (!sourceId) { const created = await admin.from('analytics_sources').insert({ project_id: projectId, provider: 'Google Analytics', connection_status: 'Connected', is_primary: true }).select('id').single(); if (created.error || !created.data) throw new Error('Unable to create the project analytics source.'); sourceId = created.data.id }
      await admin.from('analytics_sources').update({ connection_status: 'Connected', last_sync_at: new Date().toISOString(), is_primary: true }).eq('id', sourceId)
      const rows = Array.isArray(payload.rows) ? payload.rows as Record<string, unknown>[] : []; const daily = rows.flatMap((row) => { const dateValue = Array.isArray(row.dimensionValues) ? String((row.dimensionValues[0] as { value?: string })?.value ?? '') : ''; const values = Array.isArray(row.metricValues) ? row.metricValues as { value?: string }[] : []; if (!/^\d{8}$/.test(dateValue)) return []; return [{ project_id: projectId, source_id: sourceId, date: `${dateValue.slice(0, 4)}-${dateValue.slice(4, 6)}-${dateValue.slice(6)}`, unique_visitors: Number(values[0]?.value ?? 0), page_views: Number(values[1]?.value ?? 0), sessions: Number(values[2]?.value ?? 0) }] })
      if (daily.length) { const { error } = await admin.from('analytics_daily').upsert(daily, { onConflict: 'project_id,source_id,date' }); if (error) throw new Error('Google Analytics data was fetched, but daily rows could not be saved.') }
      await admin.from('provider_connections').update({ last_synced_at: new Date().toISOString() }).eq('owner_id', user.id).eq('provider', 'google_analytics')
      return response({ imported: daily.length, propertyId })
    }
    return response({ error: 'Unsupported action.' }, 400)
  } catch (error) { return response({ error: error instanceof Error ? error.message : 'Google Analytics operation failed.' }, 500) }
})
