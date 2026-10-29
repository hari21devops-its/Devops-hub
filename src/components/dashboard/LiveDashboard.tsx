import { Link } from 'react-router-dom'

import { SummaryCard } from './SummaryCard'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { useAuth } from '../../contexts/AuthContext'
import { getAnalyticsDaily, getDeployments, getDomains, getErrorEvents, getExpenses, getIncidents, getMonitors, getProjectIntegrations, getProjects, getServices } from '../../services/data'
import type { Domain, Project, Service, SummaryMetric } from '../../types'
import { useEffect, useState } from 'react'
import type { AnalyticsDailyRecord, DeploymentRecord, ErrorEventRecord, ExpenseRecord, IncidentRecord, MonitorRecord, ProjectIntegrationRecord } from '../../services/data'

function providerName(integrations: ProjectIntegrationRecord[], projectId: string, type: string) {
  const match = integrations.find((item) => item.projectId === projectId && item.resourceType.toLowerCase() === type)
  return match?.resourceName ?? 'Not connected'
}

function uptimeState(monitors: MonitorRecord[]) {
  if (monitors.length === 0) return 'Not configured'
  if (monitors.some((monitor) => monitor.enabled && ['down', 'offline', 'failed'].includes(monitor.currentStatus.toLowerCase()))) return 'Offline'
  if (monitors.some((monitor) => monitor.enabled && ['up', 'healthy', 'online'].includes(monitor.currentStatus.toLowerCase()))) return 'Online'
  return 'Awaiting first check'
}

function expenseTotalByCurrency(expenses: ExpenseRecord[], month: string) {
  const totals = new Map<string, number>()
  for (const expense of expenses) {
    if (!expense.paymentDate.startsWith(month) && expense.billingPeriod !== month) continue
    totals.set(expense.currency, (totals.get(expense.currency) ?? 0) + expense.amount)
  }
  if (totals.size === 0) return 'No records'
  return [...totals.entries()].map(([currency, total]) => `${currency} ${total.toLocaleString()}`).join(' + ')
}

function ProjectCard({
  project,
  domains,
  services,
  monitors,
  analytics,
  errors,
  integrations,
  today,
}: {
  project: Project
  domains: Domain[]
  services: Service[]
  monitors: MonitorRecord[]
  analytics: AnalyticsDailyRecord[]
  errors: ErrorEventRecord[]
  integrations: ProjectIntegrationRecord[]
  today: string
}) {
  const projectDomains = domains.filter((item) => item.projectId === project.id)
  const projectServices = services.filter((item) => item.projectId === project.id)
  const projectMonitors = monitors.filter((item) => item.projectId === project.id)
  const projectAnalyticsToday = analytics.filter((item) => item.projectId === project.id && item.date === today)
  const recentErrors = errors.filter((item) => item.projectId === project.id && Date.now() - new Date(item.lastSeenAt).getTime() <= 24 * 60 * 60 * 1000)
  const expiringSoon = projectDomains.filter((item) => item.expirationDate >= today && item.expirationDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
  const projectIntegrations = integrations.filter((item) => item.projectId === project.id)
  const lastSync = projectIntegrations.map((item) => item.lastSyncedAt).filter((value): value is string => Boolean(value)).sort().at(-1)
  const visitorsToday = projectAnalyticsToday.length ? projectAnalyticsToday.reduce((sum, item) => sum + item.visitors, 0).toLocaleString() : 'Unavailable'
  const statusTone = project.status === 'Healthy' ? 'success' : project.status === 'Warning' ? 'warning' : project.status === 'Offline' ? 'danger' : 'default'

  return (
    <Link to={`/projects/${project.id}`} aria-label={`Open ${project.name} project dashboard`} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
      <Card className="h-full transition-shadow hover:shadow-md hover:shadow-slate-300/40">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold text-white">{project.name}</h3>
              <p className="mt-1 truncate text-sm text-slate-500">{project.websiteUrl || 'No website URL'}</p>
            </div>
            <Badge variant={statusTone}>{project.status}</Badge>
          </div>
          <p className="line-clamp-2 min-h-10 text-sm text-slate-500">{project.description || 'No project description.'}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <p><span className="block text-xs text-slate-500">Hosting</span><span className="text-slate-800">{providerName(integrations, project.id, 'hosting')}</span></p>
            <p><span className="block text-xs text-slate-500">Database</span><span className="text-slate-800">{providerName(integrations, project.id, 'database')}</span></p>
            <p><span className="block text-xs text-slate-500">Domain provider</span><span className="text-slate-800">{providerName(integrations, project.id, 'domain')}</span></p>
            <p><span className="block text-xs text-slate-500">Website uptime</span><span className="text-slate-800">{uptimeState(projectMonitors)}</span></p>
            <p><span className="block text-xs text-slate-500">Visitors today</span><span className="text-slate-800">{visitorsToday}</span></p>
            <p><span className="block text-xs text-slate-500">Visitors this month</span><span className="text-slate-800">Unavailable (daily uniques cannot be summed)</span></p>
            <p><span className="block text-xs text-slate-500">Bandwidth</span><span className="text-slate-800">Unavailable</span></p>
            <p><span className="block text-xs text-slate-500">Database usage</span><span className="text-slate-800">Unavailable</span></p>
            <p><span className="block text-xs text-slate-500">Services</span><span className="text-slate-800">{projectServices.length}</span></p>
            <p><span className="block text-xs text-slate-500">Recent errors</span><span className="text-slate-800">{projectIntegrations.some((item) => item.resourceType.toLowerCase() === 'errors') ? recentErrors.length : 'Unavailable'}</span></p>
          </div>
          {expiringSoon.length ? <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{expiringSoon.length} domain{expiringSoon.length === 1 ? '' : 's'} expiring within 30 days</p> : null}
          <p className="text-xs text-slate-500">Last sync: {lastSync ? new Date(lastSync).toLocaleString() : 'Not synced'}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

export function LiveDashboard() {
  const { isDemoMode } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [monitors, setMonitors] = useState<MonitorRecord[]>([])
  const [incidents, setIncidents] = useState<IncidentRecord[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsDailyRecord[]>([])
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([])
  const [errors, setErrors] = useState<ErrorEventRecord[]>([])
  const [integrations, setIntegrations] = useState<ProjectIntegrationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    void Promise.all([
      getProjects(), getDomains(), getServices(), getExpenses(), getMonitors(), getIncidents(),
      getAnalyticsDaily(undefined, monthStart), getDeployments(), getErrorEvents(), getProjectIntegrations(),
    ]).then(([p, d, s, e, m, i, a, dep, err, intg]) => {
      if (!active) return
      setProjects(p); setDomains(d); setServices(s); setExpenses(e); setMonitors(m); setIncidents(i)
      setAnalytics(a); setDeployments(dep); setErrors(err); setIntegrations(intg)
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load project overview.')
    }).finally(() => {
      if (active) setIsLoading(false)
    })
    return () => { active = false }
  }, [isDemoMode])

  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  const todayRows = analytics.filter((row) => row.date === today)
  const monthRows = analytics.filter((row) => row.date.startsWith(month))
  const projectMonitorStates = projects.map((project) => ({
    projectId: project.id,
    statuses: monitors.filter((monitor) => monitor.projectId === project.id && monitor.enabled).map((monitor) => monitor.currentStatus.toLowerCase()),
  })).filter((project) => project.statuses.length > 0)
  const onlineCount = projectMonitorStates.filter((project) => project.statuses.every((status) => ['up', 'online', 'healthy'].includes(status))).length
  const offlineCount = projectMonitorStates.filter((project) => project.statuses.some((status) => ['down', 'offline', 'failed'].includes(status))).length
  const activeIncidents = incidents.filter((item) => !['resolved', 'closed', 'recovered'].includes(item.status.toLowerCase())).length
  const failedDeployments = deployments.filter((item) => ['failed', 'error', 'cancelled'].includes(item.status.toLowerCase())).length
  const nearQuota = services.filter((item) => item.usageLimit > 0 && item.currentUsage / item.usageLimit >= 0.9).length
  const activeProjects = projects.filter((item) => !['Archived', 'Warning'].includes(item.status)).length
  const expiringCount = domains.filter((item) => item.expirationDate >= today && item.expirationDate <= new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)).length
  const monthlyExpenses = expenseTotalByCurrency(expenses, month)
  const aggregateMetrics: SummaryMetric[] = [
    { label: 'Total Projects', value: String(projects.length), change: 'Includes archived projects' },
    { label: 'Active Projects', value: String(activeProjects), change: 'Excludes archived projects', tone: 'success' },
    { label: 'Websites Online', value: projectMonitorStates.length ? String(onlineCount) : 'Unavailable', change: projectMonitorStates.length ? 'Unique monitored projects' : 'No monitors configured', tone: onlineCount ? 'success' : 'neutral' },
    { label: 'Websites Offline', value: projectMonitorStates.length ? String(offlineCount) : 'Unavailable', change: 'Unique monitored projects', tone: offlineCount ? 'danger' : 'neutral' },
    { label: 'Visitors Today', value: todayRows.length ? todayRows.reduce((sum, row) => sum + row.visitors, 0).toLocaleString() : 'Unavailable', change: 'Sum of project uniques; not cross-site deduplicated' },
    { label: 'Visitors This Month', value: 'Unavailable', change: 'Daily unique visitors cannot be summed into monthly uniques' },
    { label: 'Page Views This Month', value: monthRows.length ? monthRows.reduce((sum, row) => sum + row.pageViews, 0).toLocaleString() : 'Unavailable', change: 'Sum across primary project sources' },
    { label: 'Domains Expiring Soon', value: domains.length ? String(expiringCount) : 'Unavailable', change: 'Within 30 days' },
    { label: 'Monthly Expenses', value: monthlyExpenses, change: 'Expense ledger only; service costs not added' },
    { label: 'Services Near Limits', value: services.length ? String(nearQuota) : 'Unavailable', change: 'At least 90% usage', tone: nearQuota ? 'warning' : 'neutral' },
    { label: 'Active Incidents', value: incidents.length ? String(activeIncidents) : '0', change: 'From incident records', tone: activeIncidents ? 'danger' : 'success' },
    { label: 'Failed Deployments', value: deployments.length ? String(failedDeployments) : 'Unavailable', change: 'From connected deployment sources', tone: failedDeployments ? 'danger' : 'neutral' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Workspace overview</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">All projects</h2>
        </div>
        <Badge variant="default">Project-level data only</Badge>
      </div>
      {error ? <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading projects and metrics...</p> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {aggregateMetrics.map((metric) => <SummaryCard key={metric.label} metric={metric} />)}
        </div>
      )}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg font-semibold text-white">Project overview</h3>
          <Link to="/projects" className="text-sm text-sky-700 hover:underline">Manage projects</Link>
        </div>
        {!isLoading && projects.length === 0 ? <Card><CardContent className="p-6 text-sm text-slate-500">No projects yet. Add a project to start tracking its data.</CardContent></Card> : null}
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {projects.map((project) => <ProjectCard key={project.id} project={project} domains={domains} services={services} monitors={monitors} analytics={analytics} errors={errors} integrations={integrations} today={today} />)}
        </div>
      </section>
    </div>
  )
}
