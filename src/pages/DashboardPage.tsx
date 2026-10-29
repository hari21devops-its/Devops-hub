import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { SummaryCard } from '../components/dashboard/SummaryCard'
import { LiveDashboard } from '../components/dashboard/LiveDashboard'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { overviewMetrics, notificationList, projectList, domainList, serviceList, spendData, trafficData } from '../lib/demo-data'
import { useAuth } from '../contexts/AuthContext'
import { getDomains, getProjects, getServices } from '../services/data'
import type { Domain, Project, Service, SummaryMetric } from '../types'

const pieData = [
  { name: 'Production', value: 54, color: '#38bdf8' },
  { name: 'Staging', value: 28, color: '#a78bfa' },
  { name: 'Development', value: 18, color: '#34d399' },
]

export function DashboardPage() {
  const { isDemoMode } = useAuth()
  return isDemoMode ? <DemoDashboardPage /> : <LiveDashboard />
}

function DemoDashboardPage() {
  const { isDemoMode } = useAuth()
  const [projects, setProjects] = useState<Project[]>(isDemoMode ? projectList : [])
  const [domains, setDomains] = useState<Domain[]>(isDemoMode ? domainList : [])
  const [services, setServices] = useState<Service[]>(isDemoMode ? serviceList : [])
  const [isLoading, setIsLoading] = useState(!isDemoMode)
  const [dataError, setDataError] = useState('')

  useEffect(() => {
    if (isDemoMode) {
      setProjects(projectList)
      setDomains(domainList)
      setServices(serviceList)
      setDataError('')
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    setDataError('')
    void Promise.all([getProjects(), getDomains(), getServices()])
      .then(([loadedProjects, loadedDomains, loadedServices]) => {
        if (active) {
          setProjects(loadedProjects)
          setDomains(loadedDomains)
          setServices(loadedServices)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setDataError(error instanceof Error ? error.message : 'Unable to load workspace data.')
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [isDemoMode])

  const today = new Date().toISOString().slice(0, 10)
  const expiringLimit = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const expiringDomains = domains.filter((domain) => domain.expirationDate >= today && domain.expirationDate <= expiringLimit).length
  const activeWebsites = projects.filter((project) => project.websiteUrl.trim() && project.status !== 'Archived').length
  const paidServices = services.filter((service) => service.isPaid).length
  const servicesNearQuota = services.filter((service) => service.usageLimit > 0 && service.currentUsage / service.usageLimit >= 0.9).length
  const liveMetrics: SummaryMetric[] = [
    { label: 'Total Projects', value: String(projects.length), change: 'Live workspace records', tone: 'neutral' },
    { label: 'Active Websites', value: String(activeWebsites), change: 'From active projects', tone: 'success' },
    { label: 'Domains Expiring Soon', value: String(expiringDomains), change: 'Within 30 days', tone: expiringDomains ? 'warning' : 'success' },
    { label: 'Paid Services', value: String(paidServices), change: 'Live service records', tone: 'neutral' },
    { label: 'Services Near Quota', value: String(servicesNearQuota), change: 'At least 90% usage', tone: servicesNearQuota ? 'warning' : 'success' },
  ]
  const displayedMetrics = isDemoMode ? overviewMetrics : liveMetrics

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Overview</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Infrastructure snapshot</h2>
        </div>
        <Badge variant="default">{isDemoMode ? 'Demo data only' : 'Live workspace / sample analytics'}</Badge>
      </div>

      {dataError ? <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">{dataError}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {isLoading ? <p className="text-sm text-slate-400">Loading workspace metrics...</p> : displayedMetrics.map((metric) => (
          <SummaryCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Visitor traffic' : 'Visitor traffic (sample)'}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="trafficFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="visitors" stroke="#38bdf8" fill="url(#trafficFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Environment mix' : 'Environment mix (sample)'}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Monthly expenses' : 'Monthly expenses (sample)'}</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendData}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#34d399" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Recent notifications' : 'Recent notifications (sample)'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {notificationList.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{item.title}</p>
                  <Badge
                    variant={item.type === 'critical' ? 'danger' : item.type === 'warning' ? 'warning' : 'default'}
                  >
                    {item.type}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">{item.timestamp}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Projects requiring attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {projects.length === 0 && !isDemoMode ? (
              <p className="text-sm text-slate-400">No projects are visible in this workspace yet.</p>
            ) : projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/30 p-4">
                <div>
                  <p className="font-medium text-white">{project.name}</p>
                  <p className="text-sm text-slate-400">{project.environment} • {project.websiteUrl}</p>
                </div>
                <Badge variant={project.status === 'Healthy' ? 'success' : project.status === 'Warning' ? 'warning' : 'danger'}>
                  {project.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Platform status' : 'Platform status (sample)'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {['Firebase Hosting', 'Supabase', 'Cloudflare', 'GitHub Actions'].map((service, index) => (
              <div key={service} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <span className="text-sm text-slate-200">{service}</span>
                <Badge variant={index % 2 === 0 ? 'success' : 'warning'}>{index % 2 === 0 ? 'Healthy' : 'Review'}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
