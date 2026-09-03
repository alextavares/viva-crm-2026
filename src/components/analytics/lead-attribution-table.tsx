import type { LeadAttributionMetrics } from "@/lib/analytics/lead-attribution"

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

type LeadAttributionTableProps = {
  metrics: LeadAttributionMetrics
}

export function LeadAttributionTable({ metrics }: LeadAttributionTableProps) {
  if (metrics.rows.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        Nenhum fechamento atribuído no período selecionado.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-2 text-left font-medium">Origem</th>
            <th className="px-4 py-2 text-left font-medium">Campanha</th>
            <th className="px-4 py-2 text-right font-medium">Fechamentos</th>
            <th className="px-4 py-2 text-right font-medium">Valor total</th>
          </tr>
        </thead>
        <tbody>
          {metrics.rows.map((row) => (
            <tr key={`${row.origin}-${row.campaign ?? "sem-campanha"}`} className="border-b hover:bg-muted/20">
              <td className="px-4 py-2 font-medium">{formatOriginLabel(row.origin)}</td>
              <td className="px-4 py-2 text-muted-foreground">{row.campaign ?? "—"}</td>
              <td className="px-4 py-2 text-right tabular-nums">{row.closedCount}</td>
              <td className="px-4 py-2 text-right tabular-nums font-semibold">
                {formatCurrency(row.closedValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
