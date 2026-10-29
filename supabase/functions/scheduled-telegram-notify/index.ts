import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function base64ToBytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function decryptToken(ciphertext: string, encodedIv: string) {
  const encodedKey = Deno.env.get('PROVIDER_ENCRYPTION_KEY')
  if (!encodedKey) throw new Error('Provider encryption is not configured.')
  const keyBytes = base64ToBytes(encodedKey)
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt'])
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(encodedIv) }, key, base64ToBytes(ciphertext))
  return new TextDecoder().decode(plaintext)
}

async function sendTelegram(token: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  const payload = await response.json()
  return response.ok && payload.ok === true
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed.', { status: 405 })
  if (!Deno.env.get('UPTIME_CRON_SECRET') || request.headers.get('x-uptime-cron-secret') !== Deno.env.get('UPTIME_CRON_SECRET')) {
    return new Response('Unauthorized.', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return new Response('Supabase function secrets are not configured.', { status: 500 })

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: connections, error } = await admin.from('provider_connections')
    .select('owner_id, account_id, encrypted_token, token_iv')
    .eq('provider', 'telegram')
  if (error) return new Response('Unable to load Telegram connections.', { status: 500 })

  let sent = 0
  for (const connection of connections ?? []) {
    const { data: notifications } = await admin.from('notifications')
      .select('id, title, message, type')
      .eq('recipient_id', connection.owner_id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10)
    if (!notifications?.length) continue

    const token = await decryptToken(String(connection.encrypted_token), String(connection.token_iv))
    for (const notification of notifications) {
      const delivered = await sendTelegram(token, String(connection.account_id), `[${String(notification.type).toUpperCase()}] ${notification.title}\n${String(notification.message ?? '')}`)
      if (!delivered) continue
      await admin.from('notifications').update({ is_read: true }).eq('id', notification.id).eq('recipient_id', connection.owner_id)
      sent += 1
    }
    await admin.from('provider_connections').update({ last_synced_at: new Date().toISOString() }).eq('owner_id', connection.owner_id).eq('provider', 'telegram')
  }

  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
