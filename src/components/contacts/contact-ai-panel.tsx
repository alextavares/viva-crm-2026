"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Bot, Loader2, PauseCircle, PlayCircle, Sparkles, UserRoundCheck, WandSparkles } from "lucide-react"
import { toast } from "sonner"

import {
  pauseAiLeadSession,
  requestAiLeadHandoffAction,
  resumeAiLeadSession,
  startAiLeadSession,
  takeOverAiConversation,
} from "@/app/actions/ai-leads"
import { Button } from "@/components/ui/button"

type SessionSnapshot = {
  id: string
  status: string
  source: string
  current_step: string
  started_at: string
  last_message_at: string | null
  qualified_at: string | null
  handoff_requested_at: string | null
  handoff_completed_at: string | null
  paused_at: string | null
  assigned_to_at_handoff: string | null
} | null

type QualificationSnapshot = {
  intent: string | null
  transaction_type: string | null
  property_type: string | null
  city: string | null
  neighborhoods: string[] | null
  budget_min: number | null
  budget_max: number | null
  timeline: string | null
  stage_score: number
  summary: string | null
} | null

type Props = {
  contactId: string
  propertyId: string | null
  canManage: boolean
  canRequestHandoff: boolean
  waHref: string | null
  financingWaHref: string | null
  session: SessionSnapshot
  qualification: QualificationSnapshot
  recentMessages: Array<{
    id: string
    direction: "inbound" | "outbound"
    author: string
    content: string
    created_at: string
  }>
  handoffProfileName: string | null
}

function statusLabel(status: string | null | undefined) {
  switch (status) {
    case "active":
      return "Ativa"
    case "qualified":
      return "Qualificada"
    case "handoff_requested":
      return "Handoff solicitado"
    case "handoff_completed":
      return "Assumida pelo corretor"
    case "paused":
      return "Pausada"
    case "closed":
      return "Encerrada"
    default:
      return "Não iniciada"
  }
}

function statusClass(status: string | null | undefined) {
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

function formatDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function intentLabel(value: string | null | undefined) {
  if (value === "buy") return "Compra"
  if (value === "rent") return "Aluguel"
  if (value === "sell") return "Venda"
  return "Em aberto"
}

function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined
) {
  if (typeof min === "number" && typeof max === "number") {
    return `R$ ${min.toLocaleString("pt-BR")} a R$ ${max.toLocaleString("pt-BR")}`
  }

  if (typeof max === "number") {
    return `até R$ ${max.toLocaleString("pt-BR")}`
  }

  if (typeof min === "number") {
    return `a partir de R$ ${min.toLocaleString("pt-BR")}`
  }

  return "Em aberto"
}

function formatRegion(city: string | null | undefined, neighborhoods: string[] | null | undefined) {
  const cleanedNeighborhoods = (neighborhoods ?? []).filter(Boolean)
  if (city && cleanedNeighborhoods.length > 0) {
    return `${city} • ${cleanedNeighborhoods.join(", ")}`
  }

  if (city) return city
  if (cleanedNeighborhoods.length > 0) return cleanedNeighborhoods.join(", ")
  return "Em aberto"
}

function scoreClass(score: number) {
  if (score >= 80) return "bg-emerald-100 text-emerald-800 border-emerald-200"
  if (score >= 50) return "bg-amber-100 text-amber-800 border-amber-200"
  return "bg-zinc-100 text-zinc-700 border-zinc-200"
}

function isMatureSession(status: string | null | undefined) {
  return status === "qualified" || status === "handoff_requested" || status === "handoff_completed"
}

const VISIT_KEYWORDS = ["visita", "ver imovel", "ver imóvel", "agendar", "marcar"]
const FINANCING_KEYWORDS = ["financiamento", "credito", "crédito", "banco"]

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
}

function hasKeyword(haystack: string, keywords: string[]) {
  const normalized = normalizeText(haystack)
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)))
}

type Recommendation = {
  title: string
  reason: string
  action: "schedule_visit" | "offer_financing" | "take_over" | "send_whatsapp"
}

function getRecommendation(input: {
  summary: string | null | undefined
  intent: string | null | undefined
  timeline: string | null | undefined
  recentMessages: Array<{ content: string }>
  waHref: string | null
  financingWaHref: string | null
  status: string | null | undefined
}): Recommendation {
  const messageText = [
    input.summary ?? "",
    ...input.recentMessages.map((message) => message.content ?? ""),
  ]
    .join(" ")
    .trim()

  if (input.status === "handoff_completed") {
    return {
      title: "Conversação já assumida",
      reason: "O corretor já assumiu este lead.",
      action: "take_over",
    }
  }

  if (!input.waHref) {
    return {
      title: "Assumir conversa",
      reason: "Sem telefone disponível para WhatsApp.",
      action: "take_over",
    }
  }

  if (messageText && hasKeyword(messageText, VISIT_KEYWORDS)) {
    return {
      title: "Agendar visita",
      reason: "Sinais claros de interesse em visita.",
      action: "schedule_visit",
    }
  }

  if (messageText && hasKeyword(messageText, FINANCING_KEYWORDS)) {
    return {
      title: "Oferecer financiamento",
      reason: "Lead mencionou financiamento ou crédito.",
      action: "offer_financing",
    }
  }

  if ((input.intent === "buy" || input.intent === "rent") && input.timeline) {
    return {
      title: "Assumir conversa",
      reason: "Lead qualificado e com prazo definido.",
      action: "take_over",
    }
  }

  return {
    title: "Enviar WhatsApp",
    reason: "Contato pronto para abordagem inicial.",
    action: "send_whatsapp",
  }
}

export function ContactAiPanel({
  contactId,
  propertyId,
  canManage,
  canRequestHandoff,
  waHref,
  financingWaHref,
  session,
  qualification,
  recentMessages,
  handoffProfileName,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const matureSession = isMatureSession(session?.status)
  const score = qualification?.stage_score ?? 0
  const recommendation =
    matureSession && session?.status !== "handoff_completed"
    ? getRecommendation({
        summary: qualification?.summary,
        intent: qualification?.intent,
        timeline: qualification?.timeline,
        recentMessages,
        waHref,
        financingWaHref,
        status: session?.status,
      })
    : null
  const canUseWhatsApp = Boolean(waHref)
  const canUseFinancingWhatsApp = Boolean(financingWaHref)
  const appointmentParams = new URLSearchParams({
    contactId,
    returnTo: `/contacts/${contactId}`,
  })
  if (propertyId) {
    appointmentParams.set("propertyId", propertyId)
  }
  const appointmentHref = `/appointments/new?${appointmentParams.toString()}`

  const runAction = (runner: () => Promise<{ success: boolean; error?: string }>, successMessage: string) => {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await runner()
      if (!result.success) {
        const message = result.error || "Falha ao operar a sessão IA."
        setErrorMsg(message)
        toast.error(message)
        return
      }

      toast.success(successMessage)
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="h-4 w-4 text-primary" />
            Pré-atendimento IA
          </h2>
          <p className="text-sm text-muted-foreground">
            Roteiro estruturado via WhatsApp para qualificar o lead antes do corretor assumir.
          </p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(session?.status)}`}>
          {statusLabel(session?.status)}
        </span>
      </div>

      {errorMsg ? (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMsg}
        </div>
      ) : null}

      {!session ? (
        <div className="mt-4 space-y-3 rounded-lg border border-dashed bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">
            Ainda não existe uma sessão IA ativa para este lead.
          </p>
          {canManage ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(
                  () => startAiLeadSession(contactId),
                  "Pré-atendimento IA iniciado e primeira mensagem disparada."
                )
              }
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Iniciar IA
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {matureSession ? (
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Resumo comercial do handoff
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Contexto essencial para o corretor assumir a conversa com rapidez.
                  </div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${scoreClass(score)}`}>
                  Score {score}/100
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <CommercialField label="Objetivo" value={intentLabel(qualification?.intent)} />
                <CommercialField label="Tipo de imóvel" value={qualification?.property_type || "Em aberto"} />
                <CommercialField
                  label="Faixa de preço"
                  value={formatBudgetRange(qualification?.budget_min, qualification?.budget_max)}
                />
                <CommercialField
                  label="Região"
                  value={formatRegion(qualification?.city, qualification?.neighborhoods)}
                />
                <CommercialField label="Prazo" value={qualification?.timeline || "Em aberto"} />
                <CommercialField label="Handoff" value={handoffProfileName || "Ainda não definido"} />
              </div>

              <div className="mt-4 rounded-lg border bg-background/70 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Resumo da IA</div>
                <div className="mt-1 text-sm font-medium">
                  {qualification?.summary || "Qualificação em andamento."}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Resumo</div>
                <div className="mt-1 text-sm font-medium">
                  {qualification?.summary || "Qualificação em andamento."}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Score comercial</div>
                <div className="mt-1 text-sm font-medium">{score}/100</div>
              </div>
            </div>
          )}

          {matureSession && recommendation ? (
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Próxima ação recomendada
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{recommendation.reason}</div>
              <div className="mt-3">
                {recommendation.action === "schedule_visit" ? (
                  <Button asChild>
                    <Link href={appointmentHref}>
                      {recommendation.title}
                    </Link>
                  </Button>
                ) : null}

                {recommendation.action === "offer_financing" ? (
                  <Button asChild disabled={!canUseFinancingWhatsApp}>
                    <a
                      href={financingWaHref ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {recommendation.title}
                    </a>
                  </Button>
                ) : null}

                {recommendation.action === "take_over" ? (
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        () => takeOverAiConversation(contactId),
                        "Conversa assumida pelo corretor."
                      )
                    }
                  >
                    {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRoundCheck className="mr-2 h-4 w-4" />}
                    {recommendation.title}
                  </Button>
                ) : null}

                {recommendation.action === "send_whatsapp" ? (
                  <Button asChild disabled={!canUseWhatsApp}>
                    <a href={waHref ?? "#"} target="_blank" rel="noreferrer">
                      {recommendation.title}
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            {!matureSession ? (
              <div className="rounded-lg border p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Qualificação mínima</div>
                <div className="mt-2 space-y-1 text-sm">
                  <div>Objetivo: {intentLabel(qualification?.intent)}</div>
                  <div>Tipo: {qualification?.property_type || "Em aberto"}</div>
                  <div>Região: {formatRegion(qualification?.city, qualification?.neighborhoods)}</div>
                  <div>Faixa: {formatBudgetRange(qualification?.budget_min, qualification?.budget_max)}</div>
                  <div>Prazo: {qualification?.timeline || "Em aberto"}</div>
                </div>
              </div>
            ) : null}
            <div className="rounded-lg border p-3 text-sm">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Operação</div>
              <div className="mt-2 space-y-1 text-sm">
                <div>Etapa atual: {session.current_step}</div>
                <div>Início: {formatDate(session.started_at) || "—"}</div>
                <div>Última mensagem: {formatDate(session.last_message_at) || "—"}</div>
                {!matureSession ? (
                  <div>Handoff: {handoffProfileName || "Ainda não definido"}</div>
                ) : null}
              </div>
            </div>
          </div>

          {recentMessages.length > 0 ? (
            <div className="rounded-lg border p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Últimas mensagens IA</div>
              <div className="mt-3 space-y-2">
                {recentMessages.map((message) => (
                  <div key={message.id} className="rounded-md border bg-muted/20 p-2 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{message.direction === "outbound" ? "IA" : "Lead"}</span>
                      <span>{formatDate(message.created_at) || "—"}</span>
                    </div>
                    <div>{message.content}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {session.status === "paused" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    runAction(
                      () => resumeAiLeadSession(contactId),
                      "Pré-atendimento IA retomado."
                    )
                  }
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                  Retomar IA
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || session.status === "handoff_completed"}
                  onClick={() =>
                    runAction(
                      () => pauseAiLeadSession(contactId),
                      "Pré-atendimento IA pausado."
                    )
                  }
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                  Pausar IA
                </Button>
              )}

              {canRequestHandoff && session.status !== "handoff_requested" && session.status !== "handoff_completed" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    runAction(
                      () => requestAiLeadHandoffAction(session.id),
                      "Handoff da IA solicitado com sucesso."
                    )
                  }
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WandSparkles className="mr-2 h-4 w-4" />}
                  Solicitar handoff
                </Button>
              ) : null}

              {session.status !== "handoff_completed" ? (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    runAction(
                      () => takeOverAiConversation(contactId),
                      "Conversa assumida pelo corretor."
                    )
                  }
                >
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRoundCheck className="mr-2 h-4 w-4" />}
                  Assumir conversa
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function CommercialField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/70 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  )
}
