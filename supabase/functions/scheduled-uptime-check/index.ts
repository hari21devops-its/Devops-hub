import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const checkTimeoutMs = 10_000

type Monitor = {
  id: string
  project_id: string
  url: string
  expected_status: number
  timeout_seconds: number | null
}

type Domain = {
  id: string
  project_id: string
  domain_name: string
}

function isAllowedMonitorUrl(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const hostname = url.hostname.toLowerCase()
    return hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1' && !hostname.endsWith('.local')
  } catch {
    return false
  }
}

async function checkMonitor(monitor: Monitor) {
  if (!isAllowedMonitorUrl(monitor.url)) {
    return { isUp: false, statusCode: null, responseTimeMs: null, errorCode: 'invalid_monitor_url' }
  }

  const startedAt = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(monitor.timeout_seconds ?? 10, 1) * 1000, checkTimeoutMs))

  try {
    const response = await fetch(monitor.url, { method: 'GET', redirect: 'manual', signal: controller.signal })
    const responseTimeMs = Math.round(performance.now() - startedAt)
    return {
      isUp: response.status === monitor.expected_status,
      statusCode: response.status,
      responseTimeMs,
      errorCode: response.status === monitor.expected_status ? null : 'unexpected_status',
    }
  } catch (error) {
    return {
      isUp: false,
      statusCode: null,
      responseTimeMs: Math.round(performance.now() - startedAt),
      errorCode: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'request_failed',
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function checkDomain(domain: Domain) {
  const hostname = domain.domain_name.replace(/^https?:\/\//i, '').split('/')[0]
  if (!hostname) return { dnsResolves: false, sslReachable: false, details: { error: 'invalid_domain' } }

  let dnsResolves = false
  try {
    const dnsResponse = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`)
    const dnsPayload = await dnsResponse.json()
    dnsResolves = dnsResponse.ok && Array.isArray(dnsPayload.Answer) && dnsPayload.Answer.length > 0
  } catch {
    dnsResolves = false
  }

  let sslReachable = false
  try {
    const response = await fetch(`https://${hostname}`, { method: 'HEAD', redirect: 'manual' })
    sslReachable = response.status >= 200 && response.status < 500
  } catch {
    sslReachable = false
  }

  return { dnsResolves, sslReachable, details: { hostname } }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed.', { status: 405 })

  const expectedSecret = Deno.env.get('UPTIME_CRON_SECRET')
  const suppliedSecret = request.headers.get('x-uptime-cron-secret')
  if (!expectedSecret || suppliedSecret !== expectedSecret) return new Response('Unauthorized.', { status: 401 })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return new Response('Supabase function secrets are not configured.', { status: 500 })

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: monitors, error: monitorError } = await admin
    .from('monitors')
    .select('id, project_id, url, expected_status, timeout_seconds')
    .eq('enabled', true)

  if (monitorError) return new Response('Unable to load enabled monitors.', { status: 500 })

  let checked = 0
  let online = 0
  for (const monitor of (monitors ?? []) as Monitor[]) {
    const result = await checkMonitor(monitor)
    const checkedAt = new Date().toISOString()
    const { error: checkError } = await admin.from('monitor_checks').insert({
      monitor_id: monitor.id,
      checked_at: checkedAt,
      is_up: result.isUp,
      status_code: result.statusCode,
      response_time_ms: result.responseTimeMs,
      error_code: result.errorCode,
    })
    if (checkError) continue

    const { data: currentMonitor } = await admin.from('monitors')
      .select('failure_count')
      .eq('id', monitor.id)
      .single()
    const failureCount = result.isUp ? 0 : Number(currentMonitor?.failure_count ?? 0) + 1
    await admin.from('monitors').update({
      current_status: result.isUp ? 'Up' : 'Down',
      response_time_ms: result.responseTimeMs,
      failure_count: failureCount,
      last_check_at: checkedAt,
    }).eq('id', monitor.id)

    checked += 1
    if (result.isUp) online += 1
  }

  const { data: domains } = await admin.from('domains').select('id, project_id, domain_name')
  let domainsChecked = 0
  for (const domain of (domains ?? []) as Domain[]) {
    const result = await checkDomain(domain)
    const { error } = await admin.from('domain_checks').insert({
      domain_id: domain.id,
      project_id: domain.project_id,
      dns_resolves: result.dnsResolves,
      ssl_reachable: result.sslReachable,
      details: result.details,
    })
    if (!error) domainsChecked += 1
  }

  return new Response(JSON.stringify({ checked, online, offline: checked - online, domainsChecked }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
