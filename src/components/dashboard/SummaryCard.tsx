import type { SummaryMetric } from '../../types'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'

export function SummaryCard({ metric }: { metric: SummaryMetric }) {
  const tone = metric.tone ?? 'neutral'

  return (
    <Card className="min-h-[150px]">
      <CardContent className="flex h-full flex-col justify-between gap-4 py-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">{metric.label}</p>
          <Badge variant={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'default'}>
            {tone === 'danger' ? 'Alert' : tone === 'warning' ? 'Watch' : tone === 'success' ? 'Healthy' : 'Info'}
          </Badge>
        </div>

        <div>
          <p className="text-3xl font-semibold tracking-tight text-white">{metric.value}</p>
          {metric.change ? <p className="mt-2 text-sm text-slate-400">{metric.change}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}
