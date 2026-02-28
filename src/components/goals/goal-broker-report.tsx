"use client"

import { Badge } from "@/components/ui/badge"

type ValueOrigin = "global" | "override"

export type GoalBrokerReportRow = {
  profile_id: string
  name: string | null
  email: string | null
  enabled: boolean
  period_type: "weekly" | "monthly"
  period_origin: ValueOrigin
  captacoes_enabled: boolean
  captacoes_pct: number
  captacoes_label: string
  captacoes_origin: ValueOrigin
  respostas_enabled: boolean
  respostas_pct: number
  respostas_label: string
  respostas_origin: ValueOrigin
  visitas_enabled: boolean
  visitas_pct: number
  visitas_label: string
  visitas_origin: ValueOrigin
  sla_label: string
  sla_origin: ValueOrigin
}

type Props = {
  rows: GoalBrokerReportRow[]
}

function formatPeriod(value: "weekly" | "monthly") {
  return value === "monthly" ? "Mensal" : "Semanal"
}

function OriginBadge({ origin }: { origin: ValueOrigin }) {
  return (
    <Badge variant={origin === "override" ? "default" : "secondary"} className="text-[10px] uppercase tracking-wide">
      {origin === "override" ? "Override" : "Global"}
    </Badge>
  )
}

function GoalCell({
  label,
  origin,
  reached,
}: {
  label: string
  origin: ValueOrigin
  reached?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium text-foreground">{label}</span>
      {reached ? (
        <Badge variant="secondary" className="w-fit text-[10px] font-semibold text-emerald-700">
          Meta batida
        </Badge>
      ) : null}
      <OriginBadge origin={origin} />
    </div>
  )
}

function buildMetricSummary(rows: GoalBrokerReportRow[], key: "captacoes" | "respostas" | "visitas") {
  const eligible = rows.filter((row) => {
    if (!row.enabled) return false
    if (key === "captacoes") return row.captacoes_enabled
    if (key === "respostas") return row.respostas_enabled
    return row.visitas_enabled
  })

  const reached = eligible.filter((row) => {
    if (key === "captacoes") return row.captacoes_pct >= 100
    if (key === "respostas") return row.respostas_pct >= 100
    return row.visitas_pct >= 100
  })

  const total = eligible.length
  const done = reached.length
  const pct = total > 0 ? Math.trunc((done * 100) / total) : 0

  return { done, total, pct }
}

export function GoalBrokerReport({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/10 p-4 text-sm text-muted-foreground">
        Nenhum corretor encontrado para exibir o relatório de metas.
      </div>
    )
  }

  const summary = [
    { label: "Captações", value: buildMetricSummary(rows, "captacoes") },
    { label: "Respostas", value: buildMetricSummary(rows, "respostas") },
    { label: "Visitas", value: buildMetricSummary(rows, "visitas") },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className="rounded-lg border bg-background p-4">
            <p className="text-sm font-medium text-foreground">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold">
              {item.value.done} / {item.value.total}
            </p>
            <p className="text-xs text-muted-foreground">{item.value.pct}% atingiram a meta</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-background">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Relatório Simples por Corretor</h2>
          <p className="text-sm text-muted-foreground">
            Snapshot das metas efetivas por corretor com realizado do período e origem global ou override.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/30 text-left">
              <tr className="border-b">
                <th className="px-4 py-3 font-medium">Corretor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium">Captações</th>
                <th className="px-4 py-3 font-medium">Respostas</th>
                <th className="px-4 py-3 font-medium">Visitas</th>
                <th className="px-4 py-3 font-medium">SLA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.profile_id} className="border-b align-top last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{row.name || "Corretor sem nome"}</span>
                      <span className="text-xs text-muted-foreground">{row.email || "Sem e-mail"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={row.enabled ? "secondary" : "outline"} className={row.enabled ? "text-emerald-700" : "text-amber-700"}>
                      {row.enabled ? "Ativo" : "Desativado"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <GoalCell label={formatPeriod(row.period_type)} origin={row.period_origin} />
                  </td>
                  <td className="px-4 py-3 min-w-[170px]">
                    <GoalCell
                      label={row.captacoes_label}
                      origin={row.captacoes_origin}
                      reached={row.enabled && row.captacoes_enabled && row.captacoes_pct >= 100}
                    />
                  </td>
                  <td className="px-4 py-3 min-w-[170px]">
                    <GoalCell
                      label={row.respostas_label}
                      origin={row.respostas_origin}
                      reached={row.enabled && row.respostas_enabled && row.respostas_pct >= 100}
                    />
                  </td>
                  <td className="px-4 py-3 min-w-[170px]">
                    <GoalCell
                      label={row.visitas_label}
                      origin={row.visitas_origin}
                      reached={row.enabled && row.visitas_enabled && row.visitas_pct >= 100}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <GoalCell label={row.sla_label} origin={row.sla_origin} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
