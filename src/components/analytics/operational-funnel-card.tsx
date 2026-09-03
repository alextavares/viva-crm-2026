import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { FunnelPeriod, OperationalFunnelMetrics } from "@/lib/analytics/operational-funnel"

const PERIOD_LABELS: Record<FunnelPeriod, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
}

function formatPercent(value: number | null) {
  if (value === null) return "—"
  return `${value.toFixed(1)}%`
}

type OperationalFunnelCardProps = {
  metrics: OperationalFunnelMetrics
}

export function OperationalFunnelCard({ metrics }: OperationalFunnelCardProps) {
  const hasLeadsInPeriod = metrics.totalLeads > 0

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">Funil operacional</CardTitle>
          <p className="text-sm text-muted-foreground">
            Leads recebidos e até onde avançaram no fluxo comercial.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERIOD_LABELS) as FunnelPeriod[]).map((period) => {
            const active = metrics.period === period
            return (
              <Link
                key={period}
                href={`/dashboard?funnelPeriod=${period}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[period]}
              </Link>
            )
          })}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-xs text-muted-foreground">Leads recebidos</div>
          <div className="mt-1 text-2xl font-semibold">{metrics.totalLeads}</div>
        </div>

        {hasLeadsInPeriod ? (
          <div className="space-y-2">
            {metrics.stages.map((stage) => (
              <div
                key={stage.key}
                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">{stage.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Avanço desde entrada: {formatPercent(stage.conversionFromStart)}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Avanço da etapa: {formatPercent(stage.conversionFromPrevious)}
                </div>
                <div className="text-sm font-semibold">{stage.count}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">
            Ainda sem leads no período. Publique imóveis e teste a captação pelo site para começar a acompanhar o funil.
          </div>
        )}

        <div className="flex justify-end">
          <Link
            href={`/reports?tab=funnel&funnelPeriod=${metrics.period}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver relatório completo
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
