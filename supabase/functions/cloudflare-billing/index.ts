import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const cloudflareApi = 'https://api.cloudflare.com/client/v4'

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function bytesToBase64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value))
}

async function getEncryptionKey() {
  const encoded = Deno.env.get('PROVIDER_ENCRYPTION_KEY')
  if (!encoded) throw new Error('Provider encryption is not configured.')
  const bytes = base64ToBytes(encoded)
  if (bytes.length !== 32) throw new Error('Provider encryption key must decode to 32 bytes.')
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encryptToken(token: string) {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  return { encryptedToken: bytesToBase64(new Uint8Array(ciphertext)), tokenIv: bytesToBase64(iv) }
}

async function decryptToken(ciphertext: string, encodedIv: string) {
  const key = await getEncryptionKey()
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(encodedIv) },
    key,
    base64ToBytes(ciphertext),
  )
  return new TextDecoder().decode(plaintext)
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function cloudflareRequest(path: string, token: string) {
  const response = await fetch(`${cloudflareApi}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  const payload = await response.json()
  if (!response.ok || payload.success !== true) {
    throw new Error('Cloudflare rejected the request. Check the API token and Billing Read permission.')
  }
  return payload
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  let syncRunId: string | null = null
  let adminClient: ReturnType<typeof createClient> | null = null
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase function secrets are not configured.')

    const authorization = request.headers.get('Authorization')
    if (!authorization) return jsonResponse({ error: 'Sign in is required.' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'The current session is invalid.' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    adminClient = admin
    const body = await request.json()
    const action = String(body.action ?? '')

    if (action === 'status') {
      const { data, error } = await admin.from('provider_connections')
        .select('account_id, connected_at, last_synced_at')
        .eq('owner_id', user.id)
        .eq('provider', 'cloudflare')
        .maybeSingle()
      if (error) throw new Error('Unable to read provider connection status.')
      return jsonResponse({ connected: Boolean(data), accountId: data?.account_id ?? null, connectedAt: data?.connected_at ?? null, lastSyncedAt: data?.last_synced_at ?? null })
    }

    if (action === 'connect') {
      const accountId = String(body.accountId ?? '').trim()
      const token = String(body.apiToken ?? '').trim()
      if (!/^[a-f0-9]{32}$/i.test(accountId) || !token) return jsonResponse({ error: 'Enter a valid Cloudflare account ID and API token.' }, 400)

      await cloudflareRequest(`/accounts/${accountId}/billing/history?per_page=1`, token)
      const { encryptedToken, tokenIv } = await encryptToken(token)
      const { error } = await admin.from('provider_connections').upsert({
        owner_id: user.id,
        provider: 'cloudflare',
        account_id: accountId,
        encrypted_token: encryptedToken,
        token_iv: tokenIv,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'owner_id,provider' })
      if (error) throw new Error('Unable to securely save the Cloudflare connection.')
      return jsonResponse({ connected: true, accountId })
    }

    if (action === 'sync') {
      const projectId = String(body.projectId ?? '').trim()
      if (!projectId) return jsonResponse({ error: 'Choose a project for imported billing rows.' }, 400)

      const { data: project, error: projectError } = await admin.from('projects')
        .select('id')
        .eq('id', projectId)
        .eq('owner_id', user.id)
        .maybeSingle()
      if (projectError || !project) return jsonResponse({ error: 'Project not found for this account.' }, 404)

      const { data: syncRun, error: syncRunError } = await admin.from('sync_runs').insert({
        project_id: projectId,
        provider: 'cloudflare',
        status: 'running',
      }).select('id').single()
      if (syncRunError || !syncRun) throw new Error('Unable to start the Cloudflare synchronization record.')
      syncRunId = String(syncRun.id)

      const { data: connection, error: connectionError } = await admin.from('provider_connections')
        .select('account_id, encrypted_token, token_iv')
        .eq('owner_id', user.id)
        .eq('provider', 'cloudflare')
        .maybeSingle()
      if (connectionError || !connection) throw new Error('Connect Cloudflare before syncing billing.')

      const token = await decryptToken(connection.encrypted_token, connection.token_iv)
      const invoices: Record<string, unknown>[] = []
      for (let page = 1; page <= 20; page += 1) {
        const payload = await cloudflareRequest(`/accounts/${connection.account_id}/billing/history?per_page=100&page=${page}`, token)
        const rows = Array.isArray(payload.result) ? payload.result as Record<string, unknown>[] : []
        invoices.push(...rows)
        const totalCount = Number(payload.result_info?.total_count)
        const totalPages = Number.isFinite(totalCount) && totalCount > 0 ? Math.ceil(totalCount / 100) : null
        if (!rows.length || rows.length < 100 || (totalPages != null && page >= totalPages)) break
      }

      const expenseRows = invoices.flatMap((invoice) => {
        const externalId = String(invoice.id ?? invoice.invoice_id ?? '')
        if (!externalId) return []
        const occurredAt = String(invoice.occurred_at ?? '')
        const amount = Number(invoice.amount ?? invoice.amount_to_pay ?? 0)
        return [{
          project_id: projectId,
          provider: 'Cloudflare',
          service: String(invoice.description ?? invoice.action ?? 'Cloudflare billing'),
          amount,
          currency: String(invoice.currency ?? 'USD'),
          billing_period: occurredAt ? occurredAt.slice(0, 7) : '',
          payment_date: occurredAt ? occurredAt.slice(0, 10) : null,
          next_payment_date: null,
          recurring: false,
          payment_status: String(invoice.status ?? 'Imported'),
          invoice_url: invoice.hosted_invoice_url ? String(invoice.hosted_invoice_url) : null,
          external_source: 'cloudflare',
          external_id: externalId,
        }]
      })

      if (expenseRows.length) {
        const { error } = await admin.from('expenses').upsert(expenseRows, { onConflict: 'project_id,external_source,external_id' })
        if (error) throw new Error('Cloudflare data was fetched, but expense records could not be saved.')
      }

      const { error: updateError } = await admin.from('provider_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('owner_id', user.id)
        .eq('provider', 'cloudflare')
      if (updateError) throw new Error('Billing imported, but sync status could not be updated.')

      const { error: syncCompleteError } = await admin.from('sync_runs').update({
        status: 'succeeded',
        completed_at: new Date().toISOString(),
        records_imported: expenseRows.length,
      }).eq('id', syncRunId)
      if (syncCompleteError) throw new Error('Billing imported, but sync history could not be updated.')

      return jsonResponse({ imported: expenseRows.length, accountId: connection.account_id })
    }

    return jsonResponse({ error: 'Unsupported action.' }, 400)
  } catch (error) {
    if (syncRunId && adminClient) {
      await adminClient.from('sync_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Cloudflare billing operation failed.',
      }).eq('id', syncRunId)
    }
    return jsonResponse({ error: error instanceof Error ? error.message : 'Cloudflare billing operation failed.' }, 500)
  }
})
