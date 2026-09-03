import Link from "next/link"

import { SiteContactQuickActions } from "@/components/contacts/site-contact-quick-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AttendancePriority, AttendanceQueueRow } from "@/lib/attendances/attendance-types"

type Props = {
  rows: AttendanceQueueRow[]
}

const priorityClassName: Record<AttendancePriority, string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  medium: "border-sky-200 bg-sky-50 text-sky-700",
  low: "border-slate-200 bg-slate-50 text-slate-700",
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sem atividade"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sem atividade"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function getStatusLabel(status: string) {
  if (status === "new") return "Novo"
  if (status === "contacted") return "Em atendimento"
  if (status === "qualified") return "Qualificado"
  if (status === "won") return "Fechado"
  if (status === "lost") return "Perdido"
  return status || "Sem status"
}

function getDealStageLabel(stage: string | null | undefined) {
  if (stage === "lead") return "Lead"
  if (stage === "interest") return "Interesse"
  if (stage === "visit") return "Visita"
  if (stage === "negotiation") return "Negociação"
  if (stage === "closing") return "Fechamento"
  if (stage === "won") return "Fechado"
  if (stage === "lost") return "Perdido"
  return "Lead"
}

function getOriginLabel(source: string | null | undefined) {
  if (source === "site") return "Site"
  return source || "Cadastro direto"
}

export function AttendanceList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
        <h2 className="text-base font-semibold">Nenhum atendimento neste recorte</h2>
        <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou volte para todos os atendimentos.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {rows.map((row, index) => (
        <div
          key={row.id}
          className={`grid gap-3 p-4 lg:grid-cols-[1.25fr_1fr_0.95fr_auto] ${index === rows.length - 1 ? "" : "border-b"}`}
        >
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/contacts/${row.id}`} className="font-medium hover:underline">
                {row.name}
              </Link>
              <Badge variant="outline">{row.phone || "Sem telefone"}</Badge>
              <Badge variant="secondary">{getOriginLabel(row.siteMeta?.source)}</Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              Imóvel: {row.leadPropertyContext?.title || "Interesse não identificado"}
            </p>
            <p className="text-xs text-muted-foreground">
              Responsável: {row.assignedProfileName || "Sem responsável"}
            </p>
          </div>

          <div className="min-w-0 space-y-2">
            <Badge className={priorityClassName[row.nextAction.priority]} variant="outline">
              {row.nextAction.label}
            </Badge>
            <p className="text-xs text-muted-foreground">
              Último contato: {formatDateTime(row.latestInteractionAt || row.latestLeadAt || row.created_at)}
            </p>
            {row.latestInteractionSummary ? (
              <p className="truncate text-xs text-muted-foreground">{row.latestInteractionSummary}</p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-1 text-sm">
            <p className="text-muted-foreground">Situação: {getStatusLabel(row.status)}</p>
            <p className="text-muted-foreground">Estágio: {getDealStageLabel(row.deal_stage ?? null)}</p>
            <p className="text-muted-foreground">Domínio: {row.siteMeta?.domain || "Sem domínio"}</p>
            {row.nextAppointmentAt ? (
              <p className="text-muted-foreground">Próxima visita: {formatDateTime(row.nextAppointmentAt)}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 lg:min-w-[190px]">
            <SiteContactQuickActions
              contactId={row.id}
              phone={row.phone}
              status={row.status}
              contactName={row.name}
              propertyTitle={row.leadPropertyContext?.title || null}
            />
            <Button asChild variant="outline" size="sm">
              <Link href={`/contacts/${row.id}`}>Abrir ficha</Link>
            </Button>
            {row.nextAction.hrefKind === "appointment" ? (
              <Button asChild size="sm">
                <Link href={`/appointments/new?contactId=${row.id}&returnTo=${encodeURIComponent(`/contacts/${row.id}`)}`}>
                  Agendar visita
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
