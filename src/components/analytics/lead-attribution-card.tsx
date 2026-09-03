import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AttributionPeriod, LeadAttributionMetrics } from "@/lib/analytics/lead-attribution"

const PERIOD_LABELS: Record<AttributionPeriod, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatOriginLabel(origin: string) {
  const normalized = origin.trim().toLowerCase()

  if (normalized === "unknown") return "Origem não identificada"
  if (normalized === "site") return "Site"
  if (normalized === "zap") return "Zap"
  if (normalized === "imovelweb") return "Imovelweb"
  if (normalized === "olx") return "OLX"

  return origin
}

type LeadAttributionCardProps = {
  metrics: LeadAttributionMetrics
  hrefBase?: string
  hrefPathname?: string
}

export function LeadAttributionCard({
  metrics,
  hrefBase = "/dashboard",
  hrefPathname = "/reports",
}: LeadAttributionCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">Fechamentos por origem</CardTitle>
          <p className="text-sm text-muted-foreground">
            Receita atribuída por canal de entrada no período selecionado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PERIOD_LABELS) as AttributionPeriod[]).map((period) => {
            const active = metrics.period === period
            return (
              <Link
                key={period}
                href={`${hrefBase}?attributionPeriod=${period}`}
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Fechamentos</div>
            <div className="mt-1 text-2xl font-semibold">{metrics.totals.closedCount}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Valor total</div>
            <div className="mt-1 text-2xl font-semibold">{formatCurrency(metrics.totals.closedValue)}</div>
          </div>
        </div>

        <div className="space-y-2">
          {metrics.byOrigin.length > 0 ? (
            metrics.byOrigin.slice(0, 5).map((row) => (
              <div
                key={row.origin}
                className="flex items-center justify-between rounded-lg border px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium">{formatOriginLabel(row.origin)}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.closedCount} fechamento{row.closedCount === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="text-sm font-semibold">{formatCurrency(row.closedValue)}</div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Nenhum fechamento atribuído neste período.
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Link
            href={`${hrefPathname}?tab=attribution&attributionPeriod=${metrics.period}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver relatório completo
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
