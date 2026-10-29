import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'
import { createMonitor, deleteMonitor, getIncidents, getMonitorChecks, getMonitors, getProjects, setIncidentStatus, setMonitorEnabled, type IncidentRecord, type MonitorCheckRecord, type MonitorDraft, type MonitorRecord } from '../services/data'
import type { Project } from '../types'

const serviceHealth = [
  { name: 'northstarstudio.dev', uptime: '99.98%', response: '184ms', status: 'Healthy' },
  { name: 'atlas-commerce.example', uptime: '99.66%', response: '426ms', status: 'Warning' },
  { name: 'signalops.local', uptime: '92.14%', response: '910ms', status: 'Offline' },
] as const

const timelineData = [
  { date: 'Mon', uptime: 99.9 },
  { date: 'Tue', uptime: 99.8 },
  { date: 'Wed', uptime: 99.7 },
  { date: 'Thu', uptime: 99.94 },
  { date: 'Fri', uptime: 99.85 },
  { date: 'Sat', uptime: 99.92 },
  { date: 'Sun', uptime: 99.88 },
]

const incidents = [
  { title: 'Cloudflare edge timeout', severity: 'Warning', time: '02:40 UTC', status: 'Resolved in 12m' },
  { title: 'Supabase retry spike', severity: 'Critical', time: '08:12 UTC', status: 'Recovered' },
  { title: 'Payment API latency', severity: 'Warning', time: 'Yesterday', status: 'Monitoring' },
] as const

export function UptimePage() {
  const { isDemoMode } = useAuth()
  const [monitors, setMonitors] = useState<MonitorRecord[]>([])
  const [monitorChecks, setMonitorChecks] = useState<MonitorCheckRecord[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [liveIncidents, setLiveIncidents] = useState<IncidentRecord[]>([])
  const [monitorDraft, setMonitorDraft] = useState<MonitorDraft>({ projectId: '', url: '', checkInterval: 300, expectedStatus: 200 })
  const [isLoading, setIsLoading] = useState(!isDemoMode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isDemoMode) {
      setMonitors([])
      setMonitorChecks([])
      setProjects([])
      setLiveIncidents([])
      setError('')
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    void Promise.all([getMonitors(), getIncidents(), getProjects()])
      .then(async ([loadedMonitors, loadedIncidents, loadedProjects]) => {
        const loadedChecks = await getMonitorChecks(loadedMonitors.map((monitor) => monitor.id))
        if (active) {
          setMonitors(loadedMonitors)
          setMonitorChecks(loadedChecks)
          setLiveIncidents(loadedIncidents)
          setProjects(loadedProjects)
          setMonitorDraft((current) => ({ ...current, projectId: current.projectId || loadedProjects[0]?.id || '' }))
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load monitor data.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [isDemoMode])

  const handleMonitorSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const savedMonitor = await createMonitor(monitorDraft)
      setMonitors((current) => [savedMonitor, ...current])
      setError('')
      setMonitorDraft((current) => ({ ...current, url: '' }))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save monitor.')
    }
  }

  const handleMonitorToggle = async (monitor: MonitorRecord) => {
    try {
      await setMonitorEnabled(monitor.id, !monitor.enabled)
      setMonitors((current) => current.map((item) => item.id === monitor.id ? { ...item, enabled: !monitor.enabled } : item))
      setError('')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update monitor.')
    }
  }

  const handleMonitorDelete = async (monitorId: string) => {
    if (!window.confirm('Delete this monitor?')) return
    try {
      await deleteMonitor(monitorId)
      setMonitors((current) => current.filter((monitor) => monitor.id !== monitorId))
      setError('')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete monitor.')
    }
  }

  const handleIncidentStatus = async (incident: IncidentRecord) => {
    const status = incident.status === 'Resolved' ? 'Open' : 'Resolved'
    try {
      await setIncidentStatus(incident.id, status)
      setLiveIncidents((current) => current.map((item) => item.id === incident.id
        ? { ...item, status, resolvedAt: status === 'Resolved' ? new Date().toISOString() : null }
        : item))
      setError('')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update incident.')
    }
  }

  const statusTone = (status: string) => {
    const normalized = status.toLowerCase()
    return normalized === 'healthy' || normalized === 'up' || normalized === 'online'
      ? 'success'
      : normalized === 'warning' || normalized === 'degraded'
        ? 'warning'
        : 'danger'
  }
  const displayedTimeline = isDemoMode
    ? timelineData
    : monitorChecks.map((check) => ({
      date: new Date(check.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      uptime: check.isUp ? 100 : 0,
    }))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Uptime Monitoring</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Site and service health</h2>
      </div>

      {!isDemoMode ? <Badge variant="default">Live monitor status / no history table</Badge> : null}
      {error ? <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</p> : null}

      {!isDemoMode ? (
        <Card>
          <CardHeader><CardTitle>Register a monitor</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleMonitorSubmit}>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Project</span>
                <select value={monitorDraft.projectId} onChange={(event) => setMonitorDraft((current) => ({ ...current, projectId: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required disabled={!projects.length}>
                  {projects.length === 0 ? <option value="">Create a project first</option> : null}
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">URL</span>
                <input type="url" value={monitorDraft.url} onChange={(event) => setMonitorDraft((current) => ({ ...current, url: event.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" placeholder="https://example.com/health" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-slate-300">Interval (seconds)</span>
                <input type="number" min="60" step="60" value={monitorDraft.checkInterval} onChange={(event) => setMonitorDraft((current) => ({ ...current, checkInterval: Number(event.target.value) }))} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" required />
              </label>
              <div className="self-end">
                <Button type="submit" disabled={!projects.length}>Save monitor</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {isDemoMode ? serviceHealth.map((service) => (
          <Card key={service.name}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-white">{service.name}</p>
                <Badge
                  variant={
                    service.status === 'Healthy'
                      ? 'success'
                      : service.status === 'Warning'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {service.status}
                </Badge>
              </div>
              <p className="text-2xl font-semibold text-white">{service.uptime}</p>
              <p className="text-sm text-slate-400">Median response: {service.response}</p>
            </CardContent>
          </Card>
        )) : isLoading ? <p className="text-sm text-slate-400">Loading monitors...</p> : monitors.length === 0 ? <p className="text-sm text-slate-400">No monitors configured for this workspace.</p> : monitors.map((monitor) => (
          <Card key={monitor.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="break-all font-medium text-white">{monitor.url}</p>
                <Badge variant={statusTone(monitor.currentStatus)}>{monitor.currentStatus}</Badge>
              </div>
              <p className="text-2xl font-semibold text-white">{monitor.enabled ? 'Monitoring' : 'Paused'}</p>
              <p className="text-sm text-slate-400">
                {monitor.responseTimeMs == null ? 'No response recorded' : `Response: ${monitor.responseTimeMs}ms`}
                {monitor.failureCount ? ` · ${monitor.failureCount} failures` : ''}
              </p>
              {!isDemoMode ? <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void handleMonitorToggle(monitor)}>{monitor.enabled ? 'Pause' : 'Resume'}</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleMonitorDelete(monitor.id)}>Delete</Button>
              </div> : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Uptime trend' : 'Uptime history'}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {!isDemoMode && displayedTimeline.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-slate-400">No check history in the last 24 hours. A scheduled checker must write events to enable this chart.</div> : <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayedTimeline}>
                <defs>
                  <linearGradient id="uptimeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={isDemoMode ? [99.5, 100] : [0, 100]} />
                <Tooltip />
                <Area type="monotone" dataKey="uptime" stroke="#34d399" fill="url(#uptimeFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Incidents' : 'Live incidents'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isDemoMode ? incidents.map((incident) => (
              <div key={incident.title} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{incident.title}</p>
                  <Badge
                    variant={
                      incident.severity === 'Critical' ? 'danger' : incident.severity === 'Warning' ? 'warning' : 'default'
                    }
                  >
                    {incident.severity}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-400">{incident.time}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{incident.status}</p>
              </div>
            )) : isLoading ? <p className="text-sm text-slate-400">Loading incidents...</p> : liveIncidents.length === 0 ? <p className="text-sm text-slate-400">No incidents recorded.</p> : liveIncidents.map((incident) => (
              <div key={incident.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{incident.title}</p>
                  <Badge variant={statusTone(incident.severity)}>{incident.severity}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-400">{new Date(incident.startedAt).toLocaleString()}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{incident.status}</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void handleIncidentStatus(incident)}>
                    {incident.status === 'Resolved' ? 'Reopen' : 'Resolve'}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
