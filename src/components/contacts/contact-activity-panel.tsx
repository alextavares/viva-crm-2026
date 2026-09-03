"use client"

import { ArrowDownLeft, ArrowUpRight, Bot, FileText, FlaskConical, Mail, MapPin, MessageSquare, MessageSquareText, Phone, ShieldAlert, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ContactInteractionForm } from "@/components/contacts/contact-interaction-form"

type MessageItem = {
  id: string
  direction: "in" | "out"
  channel: string
  body: string
  created_at: string
}

type EventItem = {
  id: string
  type: string
  source: string
  payload: Record<string, unknown> | null
  created_at: string
}

type Props = {
  contactId?: string
  messages: MessageItem[]
  events: EventItem[]
  interactions: InteractionItem[]
}

type CombinedItem = 
  | { kind: "message"; date: string; data: MessageItem }
  | { kind: "event"; date: string; data: EventItem }
  | { kind: "interaction"; date: string; data: InteractionItem }

type InteractionItem = {
  id: string
  type: "call" | "email" | "visit" | "note" | "whatsapp"
  direction: "inbound" | "outbound" | null
  summary: string
  happened_at: string
  profiles: { full_name: string | null } | null
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

function eventSummary(event: EventItem) {
  if (event.type === "note_added") {
    if (event.source === "ai_leads") {
      const text = typeof event.payload?.text === "string" ? event.payload.text : null
      if (text) return text
      return "Evento operacional de IA registrado."
    }

    const text = typeof event.payload?.text === "string" ? event.payload.text : null
    if (text) return text
    const operationMode = typeof event.payload?.operation_mode === "string" ? event.payload.operation_mode : null
    if (operationMode === "sandbox") return "Mensagem registrada em sandbox."
    return "Nota operacional registrada."
  }

  if (event.type === "lead_received") return "Lead recebido."
  if (event.type === "whatsapp_policy_blocked") return "Envio oficial bloqueado por política."
  return event.type
}

function messageDirectionMeta(direction: MessageItem["direction"]) {
  if (direction === "out") {
    return {
      label: "Saída",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: ArrowUpRight,
    }
  }

  return {
    label: "Entrada",
    className: "border-sky-200 bg-sky-50 text-sky-700",
    icon: ArrowDownLeft,
  }
}

function eventMeta(event: EventItem) {
  if (event.source === "ai_leads") {
    return {
      label: "IA",
      className: "border-violet-200 bg-violet-50 text-violet-700",
      icon: Bot,
    }
  }

  if (event.payload?.operation_mode === "sandbox") {
    return {
      label: "Sandbox",
      className: "border-amber-200 bg-amber-50 text-amber-700",
      icon: FlaskConical,
    }
  }

  if (event.type === "whatsapp_policy_blocked") {
    return {
      label: "Bloqueio",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      icon: ShieldAlert,
    }
  }

  if (event.type === "lead_received") {
    return {
      label: "Lead",
      className: "border-sky-200 bg-sky-50 text-sky-700",
      icon: UserRound,
    }
  }

  return {
    label: "Evento",
    className: "border-zinc-200 bg-zinc-50 text-zinc-700",
    icon: MessageSquareText,
  }
}

const INTERACTION_META: Record<InteractionItem["type"], { label: string; className: string; icon: React.ElementType }> = {
  call: { label: "Ligação", className: "border-blue-200 bg-blue-50 text-blue-700", icon: Phone },
  email: { label: "E-mail", className: "border-purple-200 bg-purple-50 text-purple-700", icon: Mail },
  visit: { label: "Visita", className: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: MapPin },
  note: { label: "Anotação", className: "border-amber-200 bg-amber-50 text-amber-700", icon: FileText },
  whatsapp: { label: "WhatsApp", className: "border-green-200 bg-green-50 text-green-700", icon: MessageSquare },
}

export function ContactActivityPanel({ contactId, messages, events, interactions }: Props) {

  const combined: CombinedItem[] = [
    ...messages.map((m): CombinedItem => ({ kind: "message", date: m.created_at, data: m })),
    ...events.map((e): CombinedItem => ({ kind: "event", date: e.created_at, data: e })),
    ...interactions.map((interaction): CombinedItem => ({
      kind: "interaction",
      date: interaction.happened_at,
      data: interaction,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="rounded-xl border p-5 bg-background shadow-sm flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Timeline do Contato</h2>
        <p className="text-sm text-muted-foreground">O histórico mais recente de mensagens, eventos e interações registradas.</p>
      </div>

      {contactId && (
        <ContactInteractionForm contactId={contactId} />
      )}

      <div className="flex flex-col gap-4 border-l-2 border-muted pl-4 ml-2 mt-2">
        {combined.length === 0 ? (
          <div className="text-sm text-muted-foreground italic mt-2">Nenhum histórico registrado.</div>
        ) : (
          combined.map((item) => {
            if (item.kind === "message") {
              const message = item.data
              const isSandbox = message.channel === "whatsapp_official_sandbox"
              const direction = messageDirectionMeta(message.direction)
              const DirectionIcon = direction.icon

              return (
                <div key={message.id} className="relative flex flex-col gap-1.5 pt-1.5 pb-2">
                  <div className="absolute -left-[23px] top-3 h-2.5 w-2.5 rounded-full bg-border ring-4 ring-background" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${direction.className}`}>
                      <DirectionIcon className="h-3 w-3" />
                      {direction.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">{formatDateTime(message.created_at)}</span>
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">{message.channel}</Badge>
                    {isSandbox ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        <FlaskConical className="h-3 w-3" />
                        Sandbox
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm text-foreground bg-muted/40 p-3 rounded-lg border border-border/50">
                    {message.body}
                  </div>
                </div>
              )
            } else if (item.kind === "event") {
              const event = item.data
              const meta = eventMeta(event)
              const MetaIcon = meta.icon

              return (
                <div key={event.id} className="relative flex flex-col gap-1.5 pt-1.5 pb-3">
                  <div className="absolute -left-[23px] top-3 h-2.5 w-2.5 rounded-full bg-border ring-4 ring-background" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.className}`}>
                      <MetaIcon className="h-3 w-3" />
                      {meta.label}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">{formatDateTime(event.created_at)}</span>
                  </div>
                  <div className="text-sm text-foreground">
                    {eventSummary(event)}
                  </div>
                </div>
              )
            }

            const interaction = item.data
            const meta = INTERACTION_META[interaction.type] ?? INTERACTION_META.note
            const MetaIcon = meta.icon
            const isExternalWhatsApp =
              interaction.type === "whatsapp" &&
              interaction.summary.toLowerCase().includes("externo")

            return (
              <div key={interaction.id} className="relative flex flex-col gap-1.5 pt-1.5 pb-3">
                <div className="absolute -left-[23px] top-3 h-2.5 w-2.5 rounded-full bg-border ring-4 ring-background" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.className}`}>
                    <MetaIcon className="h-3 w-3" />
                    {meta.label}
                  </span>
                  {interaction.direction === "outbound" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700">
                      <ArrowUpRight className="h-3 w-3" />
                      Saída
                    </span>
                  ) : null}
                  {interaction.direction === "inbound" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-700">
                      <ArrowDownLeft className="h-3 w-3" />
                      Entrada
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground font-medium">{formatDateTime(interaction.happened_at)}</span>
                  {interaction.profiles?.full_name ? (
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                      {interaction.profiles.full_name}
                    </Badge>
                  ) : null}
                  {isExternalWhatsApp ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 px-1.5 border-emerald-200 bg-emerald-50 text-emerald-700"
                    >
                      Externo
                    </Badge>
                  ) : null}
                </div>
                <div className="text-sm text-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                  {interaction.summary}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
