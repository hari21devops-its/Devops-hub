import { useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'
import { getProviderUsageSnapshots, getServices } from '../services/data'
import type { ProviderUsageSnapshot } from '../services/data'
import type { Service } from '../types'

const quotaData = [
  { name: 'Supabase Database', current: 402, limit: 500, unit: 'GB-hours', status: 'Warning' },
  { name: 'Firebase Hosting', current: 27.8, limit: 36, unit: 'GB', status: 'Healthy' },
  { name: 'Cloudflare Bandwidth', current: 74, limit: 100, unit: '%', status: 'Healthy' },
  { name: 'GitHub Actions', current: 320, limit: 500, unit: 'minutes', status: 'Warning' },
] as const

const usageSummary = [
  { label: 'Allocated', value: '1.2 TB', tone: 'neutral' },
  { label: 'Used this month', value: '842 GB', tone: 'success' },
  { label: 'Approaching cap', value: '2 services', tone: 'warning' },
  { label: 'Forecast', value: '₹8.4K', tone: 'neutral' },
] as const

export function UsagePage() {
  const { isDemoMode } = useAuth()
  const [services, setServices] = useState<Service[]>([])
  const [snapshots, setSnapshots] = useState<ProviderUsageSnapshot[]>([])
  const [isLoading, setIsLoading] = useState(!isDemoMode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isDemoMode) {
      setServices([])
      setError('')
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    void Promise.all([getServices(), getProviderUsageSnapshots()])
      .then(([items, usageSnapshots]) => {
        if (active) { setServices(items); setSnapshots(usageSnapshots) }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load service usage.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [isDemoMode])

  const nearQuotaServices = services.filter((service) => service.usageLimit > 0 && service.currentUsage / service.usageLimit >= 0.85)
  const highestUsage = services.reduce((highest, service) => {
    const ratio = service.usageLimit > 0 ? service.currentUsage / service.usageLimit : 0
    return Math.max(highest, ratio)
  }, 0)
  const recurringCost = services.filter((service) => service.isPaid).reduce((sum, service) => sum + service.monthlyCost, 0)
  const liveUsageCount = services.length + snapshots.length
  const liveSummary = [
    { label: 'Tracked services', value: String(liveUsageCount), tone: 'neutral' as const },
    { label: 'Near quota', value: String(nearQuotaServices.length), tone: nearQuotaServices.length ? 'warning' as const : 'success' as const },
    { label: 'Recurring cost', value: `${services.find((service) => service.isPaid)?.currency ?? 'INR'} ${recurringCost.toLocaleString()}`, tone: 'neutral' as const },
    { label: 'Highest utilization', value: `${Math.round(highestUsage * 100)}%`, tone: highestUsage >= 0.85 ? 'warning' as const : 'success' as const },
  ]
  const displayedSummary = isDemoMode ? usageSummary : liveSummary
  const displayedQuotas = isDemoMode ? quotaData : [
    ...services.map((service) => ({
      name: service.name,
      current: service.currentUsage,
      limit: service.usageLimit,
      unit: service.usageUnit,
      status: service.usageLimit > 0 && service.currentUsage / service.usageLimit >= 0.85 ? 'Warning' : 'Healthy',
    })),
    ...snapshots.map((snapshot) => ({
      name: `${snapshot.provider} ${snapshot.metric.replaceAll('_', ' ')}`,
      current: snapshot.value,
      limit: 0,
      unit: snapshot.unit,
      status: 'Healthy',
    })),
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Usage & Quotas</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Resource consumption and limits</h2>
      </div>

      {!isDemoMode ? <Badge variant="default">Live service usage</Badge> : null}
      {error ? <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? <p className="text-sm text-slate-400">Loading service usage...</p> : displayedSummary.map((item) => (
          <Card key={item.label}>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
              <p className="text-2xl font-semibold text-white">{item.value}</p>
              <Badge
                variant={
                  item.tone === 'success' ? 'success' : item.tone === 'warning' ? 'warning' : 'default'
                }
              >
                {item.tone === 'warning' ? 'Review soon' : 'Current'}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Quota tracker</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? <p className="text-sm text-slate-400">Loading quota records...</p> : displayedQuotas.length === 0 ? <p className="text-sm text-slate-400">No services with usage data yet.</p> : displayedQuotas.map((item) => {
              const percentage = item.limit > 0 ? Math.min((item.current / item.limit) * 100, 100) : 0

              return (
                <div key={item.name} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{item.name}</p>
                    <Badge variant={item.status === 'Healthy' ? 'success' : 'warning'}>{item.status}</Badge>
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>{item.limit > 0 ? `${item.current} / ${item.limit} ${item.unit}` : `${item.current} ${item.unit} · no limit set`}</span>
                    <span>{Math.round(percentage)}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${item.status === 'Healthy' ? 'bg-emerald-400' : 'bg-amber-400'}`}
                      style={{ width: `${Math.max(percentage, 10)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
              <CardTitle>{isDemoMode ? 'Actions' : 'Actions (sample)'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              'Upgrade Supabase plan before next billing cycle',
              'Increase Cloudflare cache allocation for peak hours',
              'Review GitHub Actions minutes for staging jobs',
            ].map((action) => (
              <div key={action} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-200">
                {action}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
