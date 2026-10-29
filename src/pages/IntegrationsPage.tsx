import { useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'
import { getProjects } from '../services/data'
import { supabase } from '../services/supabase'
import type { Project } from '../types'

export function IntegrationsPage() {
  const { isDemoMode } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [githubConnection, setGithubConnection] = useState<{ connected: boolean; accountId: string | null; lastSyncedAt: string | null }>({ connected: false, accountId: null, lastSyncedAt: null })
  const [telegramToken, setTelegramToken] = useState('')
  const [telegramChatId, setTelegramChatId] = useState('')
  const [telegramConnection, setTelegramConnection] = useState<{ connected: boolean; chatId: string | null; lastSyncedAt: string | null }>({ connected: false, chatId: null, lastSyncedAt: null })
  const [connection, setConnection] = useState<{ connected: boolean; accountId: string | null; lastSyncedAt: string | null }>({ connected: false, accountId: null, lastSyncedAt: null })
  const [isLoading, setIsLoading] = useState(!isDemoMode)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isGithubConnecting, setIsGithubConnecting] = useState(false)
  const [isGithubSyncing, setIsGithubSyncing] = useState(false)
  const [isTelegramConnecting, setIsTelegramConnecting] = useState(false)
  const [isTelegramSending, setIsTelegramSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isDemoMode || !supabase) {
      setIsLoading(false)
      return
    }

    let active = true
    void Promise.all([
      supabase.functions.invoke('cloudflare-billing', { body: { action: 'status' } }),
      supabase.functions.invoke('github-sync', { body: { action: 'status' } }),
      supabase.functions.invoke('telegram-notify', { body: { action: 'status' } }),
      getProjects(),
    ]).then(([statusResult, githubStatusResult, telegramStatusResult, loadedProjects]) => {
      if (statusResult.error) throw new Error(statusResult.error.message)
      if (githubStatusResult.error) throw new Error(githubStatusResult.error.message)
      if (telegramStatusResult.error) throw new Error(telegramStatusResult.error.message)
      if (!active) return
      setConnection(statusResult.data as typeof connection)
      setGithubConnection(githubStatusResult.data as typeof githubConnection)
      setTelegramConnection(telegramStatusResult.data as typeof telegramConnection)
      setProjects(loadedProjects)
      setProjectId((current) => current || loadedProjects[0]?.id || '')
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load integration status.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })

    return () => {
      active = false
    }
  }, [isDemoMode])

  const handleConnect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setIsConnecting(true)
    setError('')
    setMessage('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('cloudflare-billing', {
        body: { action: 'connect', accountId, apiToken },
      })
      if (invokeError) throw new Error(invokeError.message)
      if (data?.error) throw new Error(String(data.error))
      setConnection({ connected: true, accountId: String(data.accountId), lastSyncedAt: null })
      setApiToken('')
      setMessage('Cloudflare connected. The API token was not retained in the browser.')
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect Cloudflare.')
    } finally {
      setApiToken('')
      setIsConnecting(false)
    }
  }

  const handleSync = async () => {
    if (!supabase || !projectId) return
    setIsSyncing(true)
    setError('')
    setMessage('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('cloudflare-billing', {
        body: { action: 'sync', projectId },
      })
      if (invokeError) throw new Error(invokeError.message)
      if (data?.error) throw new Error(String(data.error))
      setMessage(`Imported ${Number(data.imported ?? 0)} Cloudflare billing records.`)
      setConnection((current) => ({ ...current, lastSyncedAt: new Date().toISOString() }))
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync Cloudflare billing.')
    } finally {
      setIsSyncing(false)
    }
  }

  const handleGithubConnect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setIsGithubConnecting(true)
    setError('')
    setMessage('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('github-sync', { body: { action: 'connect', apiToken: githubToken } })
      if (invokeError) throw new Error(invokeError.message)
      if (data?.error) throw new Error(String(data.error))
      setGithubConnection({ connected: true, accountId: String(data.accountId), lastSyncedAt: null })
      setGithubToken('')
      setMessage('GitHub connected. The token was not retained in the browser.')
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect GitHub.')
    } finally {
      setGithubToken('')
      setIsGithubConnecting(false)
    }
  }

  const handleGithubSync = async () => {
    if (!supabase || !projectId) return
    setIsGithubSyncing(true)
    setError('')
    setMessage('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('github-sync', { body: { action: 'sync', projectId } })
      if (invokeError) throw new Error(invokeError.message)
      if (data?.error) throw new Error(String(data.error))
      setGithubConnection((current) => ({ ...current, lastSyncedAt: new Date().toISOString() }))
      setMessage(`Imported ${Number(data.imported ?? 0)} GitHub deployment records.`)
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync GitHub deployments.')
    } finally {
      setIsGithubSyncing(false)
    }
  }

  const handleTelegramConnect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setIsTelegramConnecting(true)
    setError('')
    setMessage('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('telegram-notify', { body: { action: 'connect', botToken: telegramToken, chatId: telegramChatId } })
      if (invokeError) throw new Error(invokeError.message)
      if (data?.error) throw new Error(String(data.error))
      setTelegramConnection({ connected: true, chatId: String(data.chatId), lastSyncedAt: null })
      setTelegramToken('')
      setMessage('Telegram connected. The bot token was not retained in the browser.')
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Unable to connect Telegram.')
    } finally {
      setTelegramToken('')
      setIsTelegramConnecting(false)
    }
  }

  const handleTelegramSend = async () => {
    if (!supabase) return
    setIsTelegramSending(true)
    setError('')
    setMessage('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('telegram-notify', { body: { action: 'send_pending' } })
      if (invokeError) throw new Error(invokeError.message)
      if (data?.error) throw new Error(String(data.error))
      setTelegramConnection((current) => ({ ...current, lastSyncedAt: new Date().toISOString() }))
      setMessage(`Sent ${Number(data.sent ?? 0)} pending Telegram alerts.`)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send Telegram alerts.')
    } finally {
      setIsTelegramSending(false)
    }
  }

  const integrations = [
    { name: 'Supabase', status: isDemoMode ? 'Demo mode' : 'Connected', health: isDemoMode ? 'Demo' : 'Healthy', lastSync: isDemoMode ? 'Not syncing' : 'Live query' },
    { name: 'Cloudflare Billing', status: connection.connected ? 'Connected' : 'Not configured', health: error ? 'Needs attention' : connection.connected ? 'Ready' : 'Unavailable', lastSync: connection.lastSyncedAt ? new Date(connection.lastSyncedAt).toLocaleString() : 'Never' },
    { name: 'GitHub Deployments', status: githubConnection.connected ? 'Connected' : 'Not configured', health: error ? 'Needs attention' : githubConnection.connected ? 'Ready' : 'Unavailable', lastSync: githubConnection.lastSyncedAt ? new Date(githubConnection.lastSyncedAt).toLocaleString() : 'Never' },
    { name: 'Google Analytics', status: 'Not configured', health: 'Unavailable', lastSync: 'Never' },
    { name: 'Cloudflare', status: 'Not configured', health: 'Unavailable', lastSync: 'Never' },
    { name: 'Telegram', status: telegramConnection.connected ? 'Connected' : 'Not configured', health: error ? 'Needs attention' : telegramConnection.connected ? 'Ready' : 'Unavailable', lastSync: telegramConnection.lastSyncedAt ? new Date(telegramConnection.lastSyncedAt).toLocaleString() : 'Never' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Integrations</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Connected services and provider health</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {integrations.map((item) => (
          <Card key={item.name}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-400">Status</span>
                <Badge variant={item.status === 'Connected' ? 'success' : 'warning'}>{item.status}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-slate-400">Health</span>
                <Badge variant={item.health === 'Healthy' ? 'success' : 'warning'}>{item.health}</Badge>
              </div>
              <p className="text-sm text-slate-300">Last sync: {item.lastSync}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">{message}</p> : null}

      {!isDemoMode ? (
        <Card>
          <CardHeader><CardTitle>Cloudflare billing connection</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">Use an account API token with Billing Read permission. The token is sent to the server function, encrypted there, and not stored in browser storage.</p>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleConnect}>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Cloudflare account ID</span>
                <input value={accountId} onChange={(event) => setAccountId(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required pattern="[A-Fa-f0-9]{32}" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">API token</span>
                <input type="password" autoComplete="new-password" value={apiToken} onChange={(event) => setApiToken(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required />
              </label>
              <div><Button type="submit" disabled={isConnecting || isLoading}>{isConnecting ? 'Connecting...' : connection.connected ? 'Replace connection' : 'Connect Cloudflare'}</Button></div>
            </form>
            {connection.connected ? (
              <div className="grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-[1fr_auto] md:items-end">
                <label className="block">
                  <span className="mb-1 block text-sm text-slate-300">Import expenses to project</span>
                  <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                </label>
                <Button type="button" onClick={() => void handleSync()} disabled={isSyncing || !projectId}>{isSyncing ? 'Syncing...' : 'Sync billing history'}</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {!isDemoMode ? (
        <Card>
          <CardHeader><CardTitle>GitHub repository and deployments</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">Use a fine-grained GitHub token with repository metadata and Actions read access. The token is validated and encrypted server-side.</p>
            <form className="grid gap-4 md:grid-cols-[1fr_auto]" onSubmit={handleGithubConnect}>
              <input type="password" autoComplete="new-password" value={githubToken} onChange={(event) => setGithubToken(event.target.value)} placeholder="GitHub token" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required />
              <Button type="submit" disabled={isGithubConnecting || isLoading}>{isGithubConnecting ? 'Connecting...' : githubConnection.connected ? 'Replace GitHub connection' : 'Connect GitHub'}</Button>
            </form>
            {githubConnection.connected ? <div className="grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-[1fr_auto] md:items-end"><label className="block"><span className="mb-1 block text-sm text-slate-300">Sync repository for project</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><Button type="button" onClick={() => void handleGithubSync()} disabled={isGithubSyncing || !projectId}>{isGithubSyncing ? 'Syncing...' : 'Sync GitHub deployments'}</Button></div> : null}
          </CardContent>
        </Card>
      ) : null}

      {!isDemoMode ? (
        <Card>
          <CardHeader><CardTitle>Telegram notifications</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">Create a bot with BotFather and provide its token plus the destination chat ID. The token is validated and encrypted server-side.</p>
            <form className="grid gap-4 md:grid-cols-3" onSubmit={handleTelegramConnect}>
              <input type="password" autoComplete="new-password" value={telegramToken} onChange={(event) => setTelegramToken(event.target.value)} placeholder="Telegram bot token" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required />
              <input value={telegramChatId} onChange={(event) => setTelegramChatId(event.target.value)} placeholder="Chat ID" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required />
              <Button type="submit" disabled={isTelegramConnecting || isLoading}>{isTelegramConnecting ? 'Connecting...' : telegramConnection.connected ? 'Replace Telegram connection' : 'Connect Telegram'}</Button>
            </form>
            {telegramConnection.connected ? <Button type="button" variant="outline" onClick={() => void handleTelegramSend()} disabled={isTelegramSending}>{isTelegramSending ? 'Sending...' : 'Send pending alerts'}</Button> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recommended actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            'Reconnect Cloudflare to verify DNS sync and edge cache status.',
            'Review stale telemetry for analytics if the next sync does not appear within 30 minutes.',
            'Turn on Telegram escalation only after the incident rules are finalised.',
          ].map((action) => (
            <div key={action} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-200">
              {action}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
