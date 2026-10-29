import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

function bytesToBase64(value: Uint8Array) {
  return btoa(String.fromCharCode(...value))
}

async function encryptionKey() {
  const encoded = Deno.env.get('PROVIDER_ENCRYPTION_KEY')
  if (!encoded) throw new Error('Provider encryption is not configured.')
  const bytes = base64ToBytes(encoded)
  if (bytes.length !== 32) throw new Error('Provider encryption key must decode to 32 bytes.')
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encryptToken(token: string) {
  const key = await encryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token))
  return { encryptedToken: bytesToBase64(new Uint8Array(ciphertext)), tokenIv: bytesToBase64(iv) }
}

async function decryptToken(ciphertext: string, encodedIv: string) {
  const key = await encryptionKey()
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(encodedIv) }, key, base64ToBytes(ciphertext))
  return new TextDecoder().decode(plaintext)
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function telegramRequest(token: string, method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok || payload.ok !== true) throw new Error('Telegram rejected the request. Check the bot token and chat ID.')
  return payload.result
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  let adminClient: ReturnType<typeof createClient> | null = null
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = request.headers.get('Authorization')
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase function secrets are not configured.')
    if (!authorization) return jsonResponse({ error: 'Sign in is required.' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'The current session is invalid.' }, 401)

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
    adminClient = admin
    const body = await request.json()
    const action = String(body.action ?? '')
    const { data: connection } = await admin.from('provider_connections')
      .select('account_id, encrypted_token, token_iv, last_synced_at')
      .eq('owner_id', user.id)
      .eq('provider', 'telegram')
      .maybeSingle()

    if (action === 'status') {
      return jsonResponse({ connected: Boolean(connection), chatId: connection?.account_id ?? null, lastSyncedAt: connection?.last_synced_at ?? null })
    }

    if (action === 'connect') {
      const token = String(body.botToken ?? '').trim()
      const chatId = String(body.chatId ?? '').trim()
      if (!token || !chatId) return jsonResponse({ error: 'Enter a Telegram bot token and chat ID.' }, 400)
      await telegramRequest(token, 'getMe', {})
      const { encryptedToken, tokenIv } = await encryptToken(token)
      const { error } = await admin.from('provider_connections').upsert({
        owner_id: user.id,
        provider: 'telegram',
        account_id: chatId,
        encrypted_token: encryptedToken,
        token_iv: tokenIv,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'owner_id,provider' })
      if (error) throw new Error('Unable to securely save the Telegram connection.')
      return jsonResponse({ connected: true, chatId })
    }

    if (action === 'send_pending') {
      if (!connection) return jsonResponse({ error: 'Connect Telegram before sending alerts.' }, 404)
      const token = await decryptToken(connection.encrypted_token, connection.token_iv)
      const { data: notifications, error } = await admin.from('notifications')
        .select('id, title, message, type')
        .eq('recipient_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw new Error('Unable to load pending notifications.')
      let sent = 0
      for (const notification of notifications ?? []) {
        await telegramRequest(token, 'sendMessage', {
          chat_id: connection.account_id,
          text: `[${String(notification.type).toUpperCase()}] ${notification.title}\n${String(notification.message ?? '')}`,
        })
        const { error: updateError } = await admin.from('notifications').update({ is_read: true }).eq('id', notification.id).eq('recipient_id', user.id)
        if (!updateError) sent += 1
      }
      await admin.from('provider_connections').update({ last_synced_at: new Date().toISOString() }).eq('owner_id', user.id).eq('provider', 'telegram')
      return jsonResponse({ sent })
    }

    return jsonResponse({ error: 'Unsupported action.' }, 400)
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Telegram operation failed.' }, 500)
  }
})
