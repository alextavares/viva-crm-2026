import type { OperationalFunnelMetrics } from "@/lib/analytics/operational-funnel"

function formatPercent(value: number | null) {
  if (value === null) return "—"
  return `${value.toFixed(1)}%`
}

type OperationalFunnelTableProps = {
  metrics: OperationalFunnelMetrics
}

export function OperationalFunnelTable({ metrics }: OperationalFunnelTableProps) {
  if (metrics.stages.every((stage) => stage.count === 0)) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        Nenhum lead recebido no período selecionado.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2 text-left font-medium">Etapa</th>
            <th className="px-4 py-2 text-right font-medium">Volume</th>
            <th className="px-4 py-2 text-right font-medium">Avanço da etapa</th>
            <th className="px-4 py-2 text-right font-medium">Avanço desde entrada</th>
          </tr>
        </thead>
        <tbody>
          {metrics.stages.map((stage) => (
            <tr key={stage.key} className="border-b hover:bg-muted/20">
              <td className="px-4 py-2 font-medium">{stage.label}</td>
              <td className="px-4 py-2 text-right tabular-nums">{stage.count}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatPercent(stage.conversionFromPrevious)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums font-semibold">
                {formatPercent(stage.conversionFromStart)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
