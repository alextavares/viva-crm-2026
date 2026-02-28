"use client"

import { ArrowDownLeft, ArrowUpRight, FlaskConical, MessageSquareText, ShieldAlert, UserRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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
  messages: MessageItem[]
  events: EventItem[]
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

export function ContactActivityPanel({ messages, events }: Props) {
  return (
    <div className="rounded-lg border p-4 bg-muted/10">
      <div>
        <h2 className="text-base font-semibold">Histórico recente</h2>
        <p className="text-sm text-muted-foreground">Mensagens e eventos recentes deste contato.</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Mensagens</h3>
          {messages.length === 0 ? (
            <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
              Nenhuma mensagem registrada.
            </div>
          ) : (
            messages.map((message) => {
              const isSandbox = message.channel === "whatsapp_official_sandbox"
              const direction = messageDirectionMeta(message.direction)
              const DirectionIcon = direction.icon
              return (
                <div key={message.id} className="rounded-md border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${direction.className}`}>
                      <DirectionIcon className="h-3.5 w-3.5" />
                      {direction.label}
                    </span>
                    <Badge variant="outline">{message.channel}</Badge>
                    {isSandbox ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <FlaskConical className="h-3.5 w-3.5" />
                        Sandbox
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm">{message.body}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{formatDateTime(message.created_at)}</div>
                </div>
              )
            })
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Eventos</h3>
          {events.length === 0 ? (
            <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
              Nenhum evento registrado.
            </div>
          ) : (
            events.map((event) => {
              const meta = eventMeta(event)
              const MetaIcon = meta.icon
              return (
                <div key={event.id} className="rounded-md border bg-background p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
                      <MetaIcon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    <Badge variant="outline">{event.type}</Badge>
                    <Badge variant="outline">{event.source}</Badge>
                  </div>
                  <div className="mt-2 text-sm">{eventSummary(event)}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{formatDateTime(event.created_at)}</div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
