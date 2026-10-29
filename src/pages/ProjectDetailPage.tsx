import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom'

import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  createProjectIntegration,
  deleteProjectIntegration,
  getAnalyticsDaily,
  getDeployments,
  getDomainChecks,
  getDomains,
  getErrorEvents,
  getExpenses,
  getIncidents,
  getMonitors,
  getProjectIntegrations,
  getProviderUsageSnapshots,
  getProjects,
  getSyncRuns,
  updateProject,
  getServices,
  type AnalyticsDailyRecord,
  type DeploymentRecord,
  type DomainCheckRecord,
  type ErrorEventRecord,
  type ExpenseRecord,
  type IncidentRecord,
  type MonitorRecord,
  type ProjectIntegrationRecord,
  type ProviderUsageSnapshot,
  type SyncRunRecord,
} from '../services/data'
import type { Domain, Project, Service } from '../types'

const projectTabs = [
  ['Overview', ''],
  ['Analytics', 'analytics'],
  ['Domains', 'domains'],
  ['Services', 'services'],
  ['Usage', 'usage'],
  ['Monitoring', 'monitoring'],
  ['Deployments', 'deployments'],
  ['Errors', 'errors'],
  ['Expenses', 'expenses'],
  ['Integrations', 'integrations'],
  ['Settings', 'settings'],
] as const

type ProjectContext = { project: Project; onProjectUpdated: (project: Project) => void }

export function ProjectDetailLayout() {
  const { projectId = '' } = useParams()
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    void getProjects().then((items) => {
      if (active) setProject(items.find((item) => item.id === projectId) ?? null)
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load project.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => { active = false }
  }, [projectId])

  if (isLoading) return <p className="text-sm text-slate-500">Loading project...</p>
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>
  if (!project) {
    return <Card><CardContent className="space-y-4 p-6"><p className="text-slate-700">Project not found or you do not have access.</p><Button asChild variant="outline"><Link to="/dashboard">Return to dashboard</Link></Button></CardContent></Card>
  }

  const projectBase = `/projects/${project.id}`
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link to="/dashboard" className="hover:text-sky-700">Dashboard</Link><span aria-hidden="true">›</span><span className="text-slate-800">{project.name}</span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white">{project.name}</h2>
        </div>
        <Button asChild variant="outline" size="sm"><Link to="/dashboard"><ArrowLeft size={15} />Main dashboard</Link></Button>
      </div>
      <nav aria-label="Project sections" className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-2">
        {projectTabs.map(([label, path]) => (
          <NavLink key={label} end={!path} to={path ? `${projectBase}/${path}` : projectBase} className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-2 text-sm ${isActive ? 'bg-sky-100 font-medium text-sky-900' : 'text-slate-600 hover:bg-slate-100'}`}>
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={{ project, onProjectUpdated: (updatedProject: Project) => setProject(updatedProject) } satisfies ProjectContext} />
    </div>
  )
}

function useProjectContext() {
  return useOutletContext<ProjectContext>().project
}

function useProjectActions() {
  return useOutletContext<ProjectContext>().onProjectUpdated
}

export function ProjectOverviewPage() {
  const project = useProjectContext()
  const [domains, setDomains] = useState<Domain[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [monitors, setMonitors] = useState<MonitorRecord[]>([])
  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsDailyRecord[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [integrations, setIntegrations] = useState<ProjectIntegrationRecord[]>([])
  const [usageSnapshots, setUsageSnapshots] = useState<ProviderUsageSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setIsLoading(true)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    void Promise.all([
      getDomains(project.id), getServices(project.id), getMonitors(project.id), getIncidents(project.id),
      getAnalyticsDaily(project.id, monthStart), getExpenses(project.id), getProjectIntegrations(project.id), getProviderUsageSnapshots(project.id),
    ]).then(([d, s, m, i, a, e, resources, snapshots]) => {
      if (!active) return
      setDomains(d); setServices(s); setMonitors(m); setIncidents(i); setAnalytics(a); setExpenses(e); setIntegrations(resources); setUsageSnapshots(snapshots)
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load project data.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => { active = false }
  }, [project.id])

  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  const dailyRows = analytics.filter((row) => row.date === today)
  const monthRows = analytics.filter((row) => row.date.startsWith(month))
  const currentExpenses = expenses.filter((item) => item.paymentDate.startsWith(month) || item.billingPeriod === month)
  const activeIncidents = incidents.filter((item) => !['resolved', 'closed', 'recovered'].includes(item.status.toLowerCase())).length
  const onlineCount = monitors.filter((item) => item.enabled && ['up', 'online', 'healthy'].includes(item.currentStatus.toLowerCase())).length
  const offlineCount = monitors.filter((item) => item.enabled && ['down', 'offline', 'failed'].includes(item.currentStatus.toLowerCase())).length
  const status = monitors.length === 0 ? 'Not configured' : offlineCount ? 'Offline' : onlineCount ? 'Online' : 'Awaiting first check'
  const metricValue = (value: number, hasSource: boolean) => hasSource ? String(value) : 'Unavailable'
  const provider = (type: string) => integrations.find((item) => item.resourceType.toLowerCase() === type)?.resourceName ?? (type === 'database' && usageSnapshots.some((item) => item.provider === 'Supabase' && item.metric === 'database_storage') ? 'Supabase' : 'Not connected')
  const usageMetric = (metric: string) => {
    const snapshot = usageSnapshots.find((item) => item.metric.toLowerCase() === metric || (metric === 'database_usage' && item.metric.toLowerCase() === 'database_storage'))
    return snapshot ? `${snapshot.value.toLocaleString()} ${snapshot.unit}` : 'Unavailable'
  }

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">Project overview</h3>
        <Card><CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <div><p className="text-xs text-slate-500">Status</p><p className="mt-1 text-slate-900">{project.status}</p></div>
          <div><p className="text-xs text-slate-500">Environment</p><p className="mt-1 text-slate-900">{project.environment}</p></div>
          <div><p className="text-xs text-slate-500">Hosting</p><p className="mt-1 text-slate-900">{provider('hosting')}</p></div>
          <div><p className="text-xs text-slate-500">Database</p><p className="mt-1 text-slate-900">{provider('database')}</p></div>
          <div><p className="text-xs text-slate-500">Domain provider</p><p className="mt-1 text-slate-900">{provider('domain')}</p></div>
          <div><p className="text-xs text-slate-500">DNS provider</p><p className="mt-1 text-slate-900">{provider('dns')}</p></div>
          <div><p className="text-xs text-slate-500">Website</p><a className="mt-1 block truncate text-sky-700 hover:underline" href={project.websiteUrl} target="_blank" rel="noreferrer">{project.websiteUrl || 'Not configured'} <ExternalLink size={12} className="inline" /></a></div>
          <div><p className="text-xs text-slate-500">Uptime status</p><p className="mt-1 text-slate-900">{status}</p></div>
        </CardContent></Card>
      </section>
      <section>
        <h3 className="mb-3 text-lg font-semibold text-white">Project metrics</h3>
        {isLoading ? <p className="text-sm text-slate-500">Loading project metrics...</p> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Visitors today', metricValue(dailyRows.reduce((sum, item) => sum + item.visitors, 0), dailyRows.length > 0)],
              ['Visitors this month', 'Unavailable (daily uniques are not monthly uniques)'],
              ['Page views this month', metricValue(monthRows.reduce((sum, item) => sum + item.pageViews, 0), monthRows.length > 0)],
              ['Sessions this month', metricValue(monthRows.reduce((sum, item) => sum + item.sessions, 0), monthRows.length > 0)],
              ['Domains', String(domains.length)],
              ['Services', String(services.length)],
              ['Expenses this month', currentExpenses.length ? currentExpenses.map((expense) => `${expense.currency} ${expense.amount.toLocaleString()}`).join(' + ') : 'No records'],
              ['Active incidents', String(activeIncidents)],
              ['Bandwidth', usageMetric('bandwidth')],
              ['Egress', usageMetric('egress')],
              ['Database usage', usageMetric('database_usage')],
              ['Storage', usageMetric('storage')],
              ['Recent errors', integrations.some((item) => item.resourceType.toLowerCase() === 'errors') ? 'Open Errors tab' : 'Unavailable'],
            ].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold text-slate-900">{value}</p></CardContent></Card>)}
          </div>
        )}
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Domains</CardTitle></CardHeader><CardContent className="space-y-2">
          {domains.length ? domains.map((domain) => <div key={domain.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span>{domain.name}</span><span className="text-slate-500">Expires {domain.expirationDate || 'Unknown'}</span></div>) : <p className="text-sm text-slate-500">No domains associated with this project.</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Hosting services</CardTitle></CardHeader><CardContent className="space-y-2">
          {services.length ? services.map((service) => <div key={service.id} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span>{service.name}</span><span className="text-slate-500">{service.provider} · {service.status}</span></div>) : <p className="text-sm text-slate-500">No services associated with this project.</p>}
        </CardContent></Card>
      </section>
    </div>
  )
}

export function ProjectSectionPage() {
  const project = useProjectContext()
  const onProjectUpdated = useProjectActions()
  const { section = '' } = useParams()
  const [domains, setDomains] = useState<Domain[]>([])
  const [domainChecks, setDomainChecks] = useState<DomainCheckRecord[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [monitors, setMonitors] = useState<MonitorRecord[]>([])
  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsDailyRecord[]>([])
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [errors, setErrors] = useState<ErrorEventRecord[]>([])
  const [integrations, setIntegrations] = useState<ProjectIntegrationRecord[]>([])
  const [syncRuns, setSyncRuns] = useState<SyncRunRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    void Promise.all([
      getDomains(project.id), getServices(project.id), getExpenses(project.id), getMonitors(project.id), getIncidents(project.id),
      getAnalyticsDaily(project.id, monthStart), getDeployments(project.id), getErrorEvents(project.id), getProjectIntegrations(project.id),
      getSyncRuns(project.id), getDomainChecks(project.id),
    ]).then(([d, s, e, m, i, a, dep, err, intg, runs, checks]) => {
      if (!active) return
      setDomains(d); setDomainChecks(checks); setServices(s); setExpenses(e); setMonitors(m); setIncidents(i); setAnalytics(a); setDeployments(dep); setErrors(err); setIntegrations(intg); setSyncRuns(runs)
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load project section.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => { active = false }
  }, [project.id])

  const sectionName = section.replaceAll('-', ' ')
  const title = sectionName ? sectionName[0].toUpperCase() + sectionName.slice(1) : 'Overview'
  const empty = (text: string) => <p className="text-sm text-slate-500">{text}</p>
  if (isLoading) return <p className="text-sm text-slate-500">Loading {title.toLowerCase()} for {project.name}...</p>
  if (error) return <p role="alert" className="text-sm text-rose-700">{error}</p>

  if (section === 'analytics') return <DataSection title={`${project.name} analytics`}>
    {analytics.length ? <div className="grid gap-3 sm:grid-cols-3"><Metric label="Visitors today" value={sumAnalytics(analytics.filter((item) => item.date === new Date().toISOString().slice(0, 10)), 'visitors')} /><Metric label="Page views this month" value={sumAnalytics(analytics, 'pageViews')} /><Metric label="Sessions this month" value={sumAnalytics(analytics, 'sessions')} /></div> : empty('No primary analytics source has synced data for this project.')}
    <p className="text-xs text-slate-500">Monthly/yearly/all-time unique visitors, traffic sources, popular pages, and visitor charts require a connected analytics provider that supplies those dimensions.</p>
  </DataSection>
  if (section === 'domains') return <DataSection title={`${project.name} domains`}>{domains.length ? domains.map((item) => { const latestCheck = domainChecks.find((check) => check.domainId === item.id); return <RecordRow key={item.id} title={item.name} details={`${item.registrar || 'Registrar unavailable'} · expires ${item.expirationDate || 'unknown'} · SSL ${item.sslStatus}${latestCheck ? ` · DNS ${latestCheck.dnsResolves ? 'resolves' : 'failed'} · HTTPS ${latestCheck.sslReachable ? 'reachable' : 'unreachable'} (${new Date(latestCheck.checkedAt).toLocaleString()})` : ' · DNS/HTTPS not checked'}`} /> }) : empty('No domains are associated with this project.')}</DataSection>
  if (section === 'services') return <DataSection title={`${project.name} services`}>{services.length ? services.map((item) => <RecordRow key={item.id} title={item.name} details={`${item.provider} · ${item.planName} · ${item.status}`} />) : empty('No services are associated with this project.')}</DataSection>
  if (section === 'usage') return <DataSection title={`${project.name} usage`}>{services.length ? services.map((item) => <RecordRow key={item.id} title={item.name} details={item.usageLimit ? `${item.currentUsage} / ${item.usageLimit} ${item.usageUnit}` : 'Usage unavailable'} />) : empty('No service usage records for this project.')}</DataSection>
  if (section === 'monitoring') return <DataSection title={`${project.name} monitoring`}>{monitors.length ? monitors.map((item) => <RecordRow key={item.id} title={item.url} details={`${item.currentStatus} · ${item.enabled ? 'enabled' : 'paused'} · ${item.responseTimeMs == null ? 'no response' : `${item.responseTimeMs}ms`} · ${item.failureCount} failures`} />) : empty('No monitors configured for this project.')}{incidents.map((item) => <RecordRow key={item.id} title={item.title} details={`${item.severity} · ${item.status}`} />)}</DataSection>
  if (section === 'deployments') return <DataSection title={`${project.name} deployments`}>{deployments.length ? deployments.map((item) => <RecordRow key={item.id} title={`${item.provider} · ${item.status}`} details={`${item.environment ?? 'Environment unavailable'} · ${item.commitSha ?? 'Commit unavailable'} · ${item.startedAt ?? 'Date unavailable'}`} />) : empty('No deployment provider is connected or synced for this project.')}</DataSection>
  if (section === 'errors') return <DataSection title={`${project.name} errors`}>{errors.length ? errors.map((item) => <RecordRow key={item.id} title={item.title} details={`${item.severity ?? 'Severity unavailable'} · ${item.occurrences} occurrences · last seen ${item.lastSeenAt}`} />) : empty('No error events synced for this project.')}</DataSection>
  if (section === 'expenses') return <DataSection title={`${project.name} expenses`}>{expenses.length ? expenses.map((item) => <RecordRow key={item.id} title={`${item.provider || item.service || 'Expense'} · ${item.currency} ${item.amount}`} details={`${item.billingPeriod || 'Period unavailable'} · ${item.paymentStatus}`} />) : empty('No expenses recorded for this project.')}</DataSection>
  if (section === 'integrations') return <ProjectIntegrationsSection project={project} integrations={integrations} syncRuns={syncRuns} onSaved={(item) => setIntegrations((current) => [...current, item])} onDeleted={(id) => setIntegrations((current) => current.filter((item) => item.id !== id))} />
  if (section === 'settings') return <ProjectSettingsSection project={project} onSaved={onProjectUpdated} />
  return <DataSection title={title}>{empty('This project section is not available.')}</DataSection>
}

function sumAnalytics(rows: AnalyticsDailyRecord[], key: 'visitors' | 'pageViews' | 'sessions') {
  return rows.reduce((sum, row) => sum + row[key], 0).toLocaleString()
}

function DataSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent className="space-y-3">{children}</CardContent></Card>
}

function RecordRow({ title, details }: { title: string; details: string }) {
  return <div className="rounded-md border border-slate-200 p-3"><p className="font-medium text-slate-900">{title}</p><p className="mt-1 break-words text-sm text-slate-500">{details}</p></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p></CardContent></Card>
}

function ProjectSettingsSection({ project, onSaved }: { project: Project; onSaved: (project: Project) => void }) {
  const [draft, setDraft] = useState(project)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => { setDraft(project) }, [project])

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true); setError(''); setMessage('')
    try {
      const saved = await updateProject(draft)
      onSaved(saved)
      setMessage('Project details saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save project details.')
    } finally {
      setIsSaving(false)
    }
  }

  return <DataSection title={`${project.name} settings`}>
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    {message ? <p role="status" className="text-sm text-emerald-700">{message}</p> : null}
    <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
      <label className="block"><span className="mb-1 block text-sm text-slate-600">Project name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" required /></label>
      <label className="block"><span className="mb-1 block text-sm text-slate-600">Environment</span><select value={draft.environment} onChange={(event) => setDraft({ ...draft, environment: event.target.value as Project['environment'] })} className="w-full rounded-md border border-slate-300 px-3 py-2"><option>Development</option><option>Staging</option><option>Production</option></select></label>
      <label className="block"><span className="mb-1 block text-sm text-slate-600">Website URL</span><input type="url" value={draft.websiteUrl} onChange={(event) => setDraft({ ...draft, websiteUrl: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
      <label className="block"><span className="mb-1 block text-sm text-slate-600">Repository URL</span><input type="url" value={draft.repositoryUrl} onChange={(event) => setDraft({ ...draft, repositoryUrl: event.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
      <label className="block md:col-span-2"><span className="mb-1 block text-sm text-slate-600">Description</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
      <label className="block md:col-span-2"><span className="mb-1 block text-sm text-slate-600">Notes</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
      <Button type="submit" disabled={isSaving} className="md:col-span-2">{isSaving ? 'Saving...' : 'Save project details'}</Button>
    </form>
  </DataSection>
}

function ProjectIntegrationsSection({
  project,
  integrations,
  syncRuns,
  onSaved,
  onDeleted,
}: {
  project: Project
  integrations: ProjectIntegrationRecord[]
  syncRuns: SyncRunRecord[]
  onSaved: (item: ProjectIntegrationRecord) => void
  onDeleted: (id: string) => void
}) {
  const [provider, setProvider] = useState('')
  const [resourceType, setResourceType] = useState('hosting')
  const [resourceId, setResourceId] = useState('')
  const [resourceName, setResourceName] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const saved = await createProjectIntegration({
        projectId: project.id,
        provider,
        resourceType,
        resourceId,
        resourceName,
        connectionStatus: 'Selected',
      })
      onSaved(saved)
      setProvider(''); setResourceId(''); setResourceName(''); setError('')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to associate provider resource.')
    }
  }

  return <DataSection title={`${project.name} provider resources`}>
    <p className="text-sm text-slate-500">Associations are project-specific. This form records a selected resource; provider credential validation and discovery are separate integrations.</p>
    {integrations.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3"><div><p className="font-medium text-slate-900">{item.provider} · {item.resourceName}</p><p className="text-xs text-slate-500">{item.resourceType} · {item.connectionStatus}{item.lastSyncedAt ? ` · synced ${new Date(item.lastSyncedAt).toLocaleString()}` : ''}</p></div><Button type="button" variant="ghost" size="sm" onClick={async () => { await deleteProjectIntegration(item.id); onDeleted(item.id) }}>Remove</Button></div>)}
    <div className="space-y-2 border-t border-slate-200 pt-4"><h4 className="font-medium text-slate-900">Sync history</h4>{syncRuns.length ? syncRuns.map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3 text-sm"><span className="font-medium text-slate-900">{run.provider} · {run.status}</span><span className="text-slate-500">{run.recordsImported} records · {new Date(run.startedAt).toLocaleString()}{run.errorMessage ? ` · ${run.errorMessage}` : ''}</span></div>) : <p className="text-sm text-slate-500">No synchronization has completed for this project.</p>}</div>
    {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
    <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
      <label className="block"><span className="mb-1 block text-sm text-slate-600">Provider</span><select value={provider} onChange={(event) => setProvider(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" required><option value="">Select provider</option>{['Supabase', 'Firebase', 'Cloudinary', 'Google Analytics', 'Cloudflare', 'GitHub', 'Vercel', 'Netlify', 'Hostinger', 'Namecheap', 'Other'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="block"><span className="mb-1 block text-sm text-slate-600">Resource type</span><select value={resourceType} onChange={(event) => setResourceType(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2">{['hosting', 'database', 'domain', 'dns', 'analytics', 'repository', 'storage', 'errors'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="block"><span className="mb-1 block text-sm text-slate-600">Resource ID</span><input value={resourceId} onChange={(event) => setResourceId(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" required /></label>
      <label className="block"><span className="mb-1 block text-sm text-slate-600">Display name</span><input value={resourceName} onChange={(event) => setResourceName(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" required /></label>
      <Button type="submit" className="md:col-span-2">Associate resource</Button>
    </form>
  </DataSection>
}
