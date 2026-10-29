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

import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { useAuth } from '../contexts/AuthContext'
import { getAnalyticsDaily, type AnalyticsDailyRecord } from '../services/data'

const overviewStats = [
  { label: 'Sessions', value: '128.4K', change: '+12.8%', tone: 'success' },
  { label: 'Conversions', value: '3.8K', change: '+6.2%', tone: 'success' },
  { label: 'Avg. CTR', value: '4.7%', change: '+0.9%', tone: 'neutral' },
  { label: 'Bounce Rate', value: '31.4%', change: '-2.1%', tone: 'neutral' },
  { label: 'Revenue', value: '₹1.28L', change: '+18.4%', tone: 'success' },
] as const

const weeklyTraffic = [
  { day: 'Mon', visitors: 8200, conversions: 410 },
  { day: 'Tue', visitors: 9400, conversions: 470 },
  { day: 'Wed', visitors: 8890, conversions: 432 },
  { day: 'Thu', visitors: 10120, conversions: 520 },
  { day: 'Fri', visitors: 11840, conversions: 602 },
  { day: 'Sat', visitors: 10850, conversions: 574 },
  { day: 'Sun', visitors: 9950, conversions: 498 },
]

const channelMix = [
  { name: 'Organic', value: 42, color: '#38bdf8' },
  { name: 'Paid', value: 28, color: '#a78bfa' },
  { name: 'Social', value: 18, color: '#34d399' },
  { name: 'Referral', value: 12, color: '#fbbf24' },
]

const funnelData = [
  { step: 'Landing', value: 100 },
  { step: 'Signup', value: 68 },
  { step: 'Trial', value: 42 },
  { step: 'Purchase', value: 21 },
  { step: 'Retention', value: 16 },
]

export function AnalyticsPage() {
  const { isDemoMode } = useAuth()
  const [records, setRecords] = useState<AnalyticsDailyRecord[]>([])
  const [isLoading, setIsLoading] = useState(!isDemoMode)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isDemoMode) {
      setRecords([])
      setError('')
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    void getAnalyticsDaily()
      .then((items) => {
        if (active) setRecords(items)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load analytics.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [isDemoMode])

  const liveStats = [
    { label: 'Sessions', value: records.reduce((sum, record) => sum + record.sessions, 0).toLocaleString(), change: 'Last 7 days', tone: 'success' as const },
    { label: 'Unique visitors', value: records.reduce((sum, record) => sum + record.visitors, 0).toLocaleString(), change: 'Last 7 days', tone: 'success' as const },
    { label: 'Page views', value: records.reduce((sum, record) => sum + record.pageViews, 0).toLocaleString(), change: 'Last 7 days', tone: 'neutral' as const },
    { label: 'Synced days', value: String(records.length), change: 'With analytics data', tone: 'neutral' as const },
  ]
  const displayedStats = isDemoMode ? overviewStats : liveStats
  const displayedTraffic = isDemoMode
    ? weeklyTraffic
    : records.map((record) => ({
      day: new Date(`${record.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' }),
      visitors: record.visitors,
      conversions: record.sessions,
    }))

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Website Analytics</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Acquisition and funnel performance</h2>
      </div>

      {!isDemoMode ? <Badge variant="default">Live daily analytics / sample source mix</Badge> : null}
      {error ? <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {isLoading ? <p className="text-sm text-slate-400">Loading analytics...</p> : displayedStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
              <p className="text-2xl font-semibold text-white">{stat.value}</p>
              <Badge variant={stat.tone === 'success' ? 'success' : stat.tone === 'neutral' ? 'default' : 'warning'}>{stat.change}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Weekly traffic trend' : 'Weekly traffic trend'}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {!isDemoMode && displayedTraffic.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">{isLoading ? 'Loading analytics...' : 'No analytics data synced yet.'}</div>
            ) : <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayedTraffic}>
                <defs>
                  <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="visitors" stroke="#38bdf8" fill="url(#analyticsFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Traffic sources' : 'Traffic sources (sample)'}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {!isDemoMode ? <div className="flex h-full items-center justify-center text-sm text-slate-400">Provider source breakdown is not available in the current schema.</div> : <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={channelMix} dataKey="value" nameKey="name" innerRadius={52} outerRadius={84} paddingAngle={3}>
                  {channelMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Conversion funnel' : 'Conversion funnel (sample)'}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {!isDemoMode ? <div className="flex h-full items-center justify-center text-sm text-slate-400">Conversion events are not stored in the current schema.</div> : <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey="step" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="value" fill="#a78bfa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isDemoMode ? 'Key insights' : 'Key insights (sample)'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              'Organic traffic is up 18% on landing pages for the studio portfolio.',
              'Paid acquisition has higher conversion efficiency than previous month.',
              'Retention performance remains strongest in social-driven product traffic.',
            ].map((insight) => (
              <div key={insight} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-sm text-slate-200">
                {insight}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
