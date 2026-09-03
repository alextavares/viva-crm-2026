import Link from "next/link"
import { getAiLeadPriorityClass } from "@/lib/ai-leads/priority"

type AiLeadListItem = {
  sessionId: string
  contactId: string
  contactName: string
  status: string
  source: string
  score: number
  summary: string | null
  currentStep: string
  lastMessageAt: string | null
  startedAt: string
  handoffProfileName: string | null
  priorityLabel: "Alta" | "Media" | "Baixa"
  priorityScore: number
}

type Props = {
  items: AiLeadListItem[]
  currentStatus: string
}

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Ativa"
    case "qualified":
      return "Qualificada"
    case "handoff_requested":
      return "Handoff solicitado"
    case "handoff_completed":
      return "Assumida"
    case "paused":
      return "Pausada"
    default:
      return status
  }
}

function statusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-800 border-emerald-200"
    case "qualified":
      return "bg-sky-100 text-sky-800 border-sky-200"
    case "handoff_requested":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "handoff_completed":
      return "bg-violet-100 text-violet-800 border-violet-200"
    case "paused":
      return "bg-zinc-100 text-zinc-700 border-zinc-200"
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200"
  }
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const FILTERS = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "qualified", label: "Qualificadas" },
  { value: "handoff_requested", label: "Handoffs" },
  { value: "handoff_completed", label: "Assumidas" },
  { value: "paused", label: "Pausadas" },
]

export function AiLeadsList({ items, currentStatus }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value === "all" ? "/ai-leads" : `/ai-leads?status=${filter.value}`}
            className={`rounded-full border px-3 py-1 text-sm ${
              currentStatus === filter.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
          Nenhuma sessão IA encontrada para o filtro atual.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.sessionId}
              href={`/contacts/${item.contactId}`}
              className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{item.contactName}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getAiLeadPriorityClass(item.priorityLabel)}`}
                    >
                      Prioridade {item.priorityLabel}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.summary || "Qualificação em andamento."}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Origem: {item.source}</span>
                    <span>Score: {item.score}/100</span>
                    <span>Etapa: {item.currentStep}</span>
                    <span>Prioridade: {item.priorityScore}</span>
                    <span>Última mensagem: {formatDate(item.lastMessageAt)}</span>
                    <span>Handoff: {item.handoffProfileName || "Ainda não definido"}</span>
                  </div>
                </div>
                <span className="text-sm font-medium text-primary">Abrir contato</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
