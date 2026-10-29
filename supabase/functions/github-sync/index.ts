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

async function githubRequest(path: string, token: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(`GitHub rejected the request (${response.status}). Check repository access and token permissions.`)
  return payload
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405)

  let adminClient: ReturnType<typeof createClient> | null = null
  let syncRunId: string | null = null
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
      .eq('provider', 'github')
      .maybeSingle()

    if (action === 'status') {
      return jsonResponse({ connected: Boolean(connection), accountId: connection?.account_id ?? null, lastSyncedAt: connection?.last_synced_at ?? null })
    }

    if (action === 'connect') {
      const token = String(body.apiToken ?? '').trim()
      if (!token) return jsonResponse({ error: 'Enter a GitHub token with repository metadata and Actions read access.' }, 400)
      const profile = await githubRequest('/user', token)
      const { encryptedToken, tokenIv } = await encryptToken(token)
      const { error } = await admin.from('provider_connections').upsert({
        owner_id: user.id,
        provider: 'github',
        account_id: String(profile.login ?? profile.id),
        encrypted_token: encryptedToken,
        token_iv: tokenIv,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'owner_id,provider' })
      if (error) throw new Error('Unable to securely save the GitHub connection.')
      return jsonResponse({ connected: true, accountId: String(profile.login ?? profile.id) })
    }

    if (action === 'repositories') {
      if (!connection) return jsonResponse({ error: 'Connect GitHub before discovering repositories.' }, 404)
      const token = await decryptToken(connection.encrypted_token, connection.token_iv)
      const repositories = await githubRequest('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', token)
      return jsonResponse({ repositories: (Array.isArray(repositories) ? repositories : []).map((repository) => ({ id: String(repository.id), name: String(repository.name), fullName: String(repository.full_name), private: Boolean(repository.private) })) })
    }

    if (action === 'sync') {
      const projectId = String(body.projectId ?? '').trim()
      if (!projectId) return jsonResponse({ error: 'Choose a project to sync.' }, 400)
      const { data: project } = await admin.from('projects').select('id').eq('id', projectId).eq('owner_id', user.id).maybeSingle()
      if (!project) return jsonResponse({ error: 'Project not found for this account.' }, 404)
      if (!connection) return jsonResponse({ error: 'Connect GitHub before syncing.' }, 404)

      const { data: integration } = await admin.from('project_integrations')
        .select('id, resource_id')
        .eq('project_id', projectId)
        .eq('provider', 'GitHub')
        .in('resource_type', ['repository', 'Repository'])
        .maybeSingle()
      if (!integration) return jsonResponse({ error: 'Associate a GitHub repository with this project first.' }, 400)

      const { data: syncRun, error: syncError } = await admin.from('sync_runs').insert({ project_id: projectId, provider: 'github', status: 'running' }).select('id').single()
      if (syncError || !syncRun) throw new Error('Unable to start the GitHub synchronization record.')
      syncRunId = String(syncRun.id)

      const token = await decryptToken(connection.encrypted_token, connection.token_iv)
      const repository = encodeURIComponent(String(integration.resource_id).trim()).replace('%2F', '/')
      const payload = await githubRequest(`/repos/${repository}/actions/runs?per_page=100`, token)
      const runs = Array.isArray(payload.workflow_runs) ? payload.workflow_runs as Record<string, unknown>[] : []
      const deployments = runs.map((run) => ({
        project_id: projectId,
        provider: 'GitHub',
        external_id: String(run.id),
        status: String(run.conclusion ?? run.status ?? 'unknown'),
        environment: null,
        commit_sha: run.head_sha ? String(run.head_sha) : null,
        deployment_url: run.html_url ? String(run.html_url) : null,
        started_at: run.run_started_at ? String(run.run_started_at) : null,
        completed_at: run.updated_at ? String(run.updated_at) : null,
        metadata: { workflow: run.name ?? null, branch: run.head_branch ?? null, event: run.event ?? null },
      }))
      if (deployments.length) {
        const { error } = await admin.from('deployments').upsert(deployments, { onConflict: 'project_id,provider,external_id' })
        if (error) throw new Error('GitHub runs were fetched, but deployments could not be saved.')
      }
      const syncedAt = new Date().toISOString()
      await admin.from('project_integrations').update({ last_synced_at: syncedAt }).eq('id', integration.id)
      await admin.from('provider_connections').update({ last_synced_at: syncedAt }).eq('owner_id', user.id).eq('provider', 'github')
      await admin.from('sync_runs').update({ status: 'succeeded', completed_at: syncedAt, records_imported: deployments.length }).eq('id', syncRunId)
      return jsonResponse({ imported: deployments.length, repository: integration.resource_id })
    }

    return jsonResponse({ error: 'Unsupported action.' }, 400)
  } catch (error) {
    if (syncRunId && adminClient) {
      await adminClient.from('sync_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: error instanceof Error ? error.message : 'GitHub synchronization failed.' }).eq('id', syncRunId)
    }
    return jsonResponse({ error: error instanceof Error ? error.message : 'GitHub operation failed.' }, 500)
  }
})
