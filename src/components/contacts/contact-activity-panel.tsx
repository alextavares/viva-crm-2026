"use client"

import { useState, useTransition } from "react"
import { ArrowDownLeft, ArrowUpRight, FlaskConical, MessageSquareText, ShieldAlert, UserRound, Loader2, SendHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { addContactNote } from "@/app/actions/contacts"

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
  contactId?: string // optional down the line, but now passed
  organizationId?: string | null
  messages: MessageItem[]
  events: EventItem[]
}

type CombinedItem = 
  | { kind: "message"; date: string; data: MessageItem }
  | { kind: "event"; date: string; data: EventItem }

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

export function ContactActivityPanel({ contactId, messages, events }: Props) {
  const [noteText, setNoteText] = useState("")
  const [isPending, startTransition] = useTransition()

  const combined: CombinedItem[] = [
    ...messages.map((m): CombinedItem => ({ kind: "message", date: m.created_at, data: m })),
    ...events.map((e): CombinedItem => ({ kind: "event", date: e.created_at, data: e })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  function handleAddNote() {
    if (!contactId || !noteText.trim()) return

    startTransition(async () => {
      try {
        await addContactNote(contactId, noteText)
        setNoteText("")
        toast.success("Nota adicionada ao histórico")
      } catch (err) {
        toast.error("Erro ao adicionar nota")
        console.error(err)
      }
    })
  }

  return (
    <div className="rounded-xl border p-5 bg-background shadow-sm flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Timeline do Contato</h2>
        <p className="text-sm text-muted-foreground">O histórico mais recente de eventos, interações e notas manuais.</p>
      </div>

      {contactId && (
        <div className="flex flex-col gap-2 relative">
          <Textarea 
            placeholder="Registre uma nota rápida sobre este contato..."
            className="min-h-[80px] resize-none pr-12 text-sm bg-muted/30 focus-visible:bg-background"
            disabled={isPending}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleAddNote()
              }
            }}
          />
          <div className="absolute right-2 bottom-2">
            <Button 
                size="icon" 
                className="h-8 w-8 rounded-md" 
                disabled={!noteText.trim() || isPending}
                onClick={handleAddNote}
            >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                <span className="sr-only">Salvar nota</span>
            </Button>
          </div>
        </div>
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
            } else {
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
          })
        )}
      </div>
    </div>
  )
}
