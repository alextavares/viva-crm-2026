import { redirect } from "next/navigation"
import { Bot } from "lucide-react"

import { AiLeadsList } from "@/components/ai-leads/ai-leads-list"
import { AiLeadsMetrics } from "@/components/ai-leads/ai-leads-metrics"
import { loadAiLeadOperationsMetrics } from "@/lib/ai-leads/metrics"
import {
  getAiLeadPriorityLabel,
  getAiLeadPriorityScore,
} from "@/lib/ai-leads/priority"
import { createClient } from "@/lib/supabase/server"

type PageProps = {
  searchParams?: Promise<{
    status?: string
  }>
}

export const dynamic = "force-dynamic"

type AiLeadsPageDataResult =
  | {
      kind: "ready"
      metrics: Awaited<ReturnType<typeof loadAiLeadOperationsMetrics>>
      items: Array<{
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
        priorityScore: number
        priorityLabel: "Alta" | "Media" | "Baixa"
      }>
    }
  | { kind: "load_error" }
  | { kind: "missing_schema" }

const ALLOWED_STATUS = new Set([
  "all",
  "active",
  "qualified",
  "handoff_requested",
  "handoff_completed",
  "paused",
])

const AI_LEAD_SESSION_SELECT =
  "id, status, source, current_step, started_at, last_message_at, assigned_to_at_handoff, contact_id, contacts!ai_lead_sessions_contact_id_fkey(id, name, assigned_to), ai_lead_qualifications(stage_score, summary)"
const HOT_STATUS_VALUES = ["handoff_requested", "qualified"]
const HOT_STATUS_LIMIT = 200
const RECENT_SESSION_LIMIT = 400
const FILTERED_STATUS_LIMIT = 300

type AiLeadSessionRow = {
  id: string
  status: string
  source: string | null
  current_step: string | null
  started_at: string
  last_message_at: string | null
  assigned_to_at_handoff: string | null
  contact_id: string
  contacts: { id: string; name: string | null; assigned_to: string | null } | Array<{ id: string; name: string | null; assigned_to: string | null }> | null
  ai_lead_qualifications: Array<{ stage_score: number | null; summary: string | null }> | null
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

export default async function AiLeadsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const params = (await searchParams) ?? {}
  const status = ALLOWED_STATUS.has(params.status ?? "all") ? params.status ?? "all" : "all"

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    redirect("/dashboard")
  }

  const isAdmin = profile.role === "owner" || profile.role === "manager"
  const isBroker = profile.role === "broker"

  if (!isAdmin && !isBroker) {
    redirect("/dashboard")
  }

  const pageData = await loadAiLeadsPageData({
    supabase,
    organizationId: profile.organization_id,
    status,
    isAdmin,
    userId: user.id,
  })

  if (pageData.kind === "load_error") {
    return (
      <AiLeadQueueLayout>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
          Não foi possível carregar a fila IA agora. Tente novamente em instantes.
        </div>
      </AiLeadQueueLayout>
    )
  }

  if (pageData.kind === "missing_schema") {
    return (
      <AiLeadQueueLayout>
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
          A fila IA ainda não está disponível porque a migração não foi aplicada neste ambiente.
        </div>
      </AiLeadQueueLayout>
    )
  }

  return (
    <AiLeadQueueLayout>
      {pageData.metrics.schemaAvailable ? <AiLeadsMetrics metrics={pageData.metrics.metrics} /> : null}
      <AiLeadsList items={pageData.items} currentStatus={status} />
    </AiLeadQueueLayout>
  )
}

async function loadAiLeadsPageData({
  supabase,
  organizationId,
  status,
  isAdmin,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  status: string
  isAdmin: boolean
  userId: string
}): Promise<AiLeadsPageDataResult> {
  try {
    const metrics = await loadAiLeadOperationsMetrics(supabase, organizationId)

    const baseQuery = () =>
      supabase
        .from("ai_lead_sessions")
        .select(AI_LEAD_SESSION_SELECT)
        .eq("organization_id", organizationId)

    const queryResults =
      status === "all"
        ? await Promise.all([
            baseQuery()
              .in("status", HOT_STATUS_VALUES)
              .order("updated_at", { ascending: false })
              .limit(HOT_STATUS_LIMIT),
            baseQuery().order("updated_at", { ascending: false }).limit(RECENT_SESSION_LIMIT),
          ])
        : [
            await baseQuery()
              .eq("status", status)
              .order("updated_at", { ascending: false })
              .limit(FILTERED_STATUS_LIMIT),
          ]

    const firstError = queryResults.find((result) => result.error)?.error ?? null
    const errorMessage = firstError
      ? `${firstError.code ?? ""} ${firstError.message ?? ""} ${firstError.details ?? ""} ${firstError.hint ?? ""}`.trim()
      : null
    const isMissingSchema = errorMessage ? /ai_lead_sessions|PGRST205|42P01|42703/i.test(errorMessage) : false

    if (firstError) {
      if (isMissingSchema) {
        return { kind: "missing_schema" }
      }

      console.error("Error loading ai leads queue:", firstError)
      return { kind: "load_error" }
    }

    const mergedSessions = Array.from(
      queryResults
        .flatMap((result) => (result.data ?? []) as unknown as AiLeadSessionRow[])
        .reduce((map, row) => map.set(row.id, row), new Map<string, AiLeadSessionRow>())
        .values()
    )

    const sessions = mergedSessions.filter((row) => {
      const contact = firstRelation(row.contacts)
      const assignedTo = contact?.assigned_to ?? null
      const handoffTo = row.assigned_to_at_handoff ?? null
      if (isAdmin) return true
      return assignedTo === userId || handoffTo === userId
    })

    const handoffProfileIds = Array.from(
      new Set(sessions.map((row) => row.assigned_to_at_handoff).filter(Boolean))
    ) as string[]

    let handoffProfileMap = new Map<string, string | null>()
    if (handoffProfileIds.length > 0) {
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", handoffProfileIds)

      handoffProfileMap = new Map((profileRows ?? []).map((row) => [row.id, row.full_name ?? null]))
    }

    const items = sessions
      .map((row) => {
        const contact = firstRelation(row.contacts)
        const qualification = firstRelation(row.ai_lead_qualifications)
        const stageScore = qualification?.stage_score ?? 0
        const priorityScore = getAiLeadPriorityScore({
          status: row.status,
          stageScore,
          lastMessageAt: row.last_message_at,
          startedAt: row.started_at,
          assignedToAtHandoff: row.assigned_to_at_handoff,
        })

        return {
          sessionId: row.id,
          contactId: row.contact_id,
          contactName: contact?.name || "Contato sem nome",
          status: row.status,
          source: row.source ?? "Não informada",
          score: stageScore,
          summary: qualification?.summary ?? null,
          currentStep: row.current_step ?? "Não informada",
          lastMessageAt: row.last_message_at,
          startedAt: row.started_at,
          handoffProfileName: row.assigned_to_at_handoff
            ? handoffProfileMap.get(row.assigned_to_at_handoff) ?? null
            : null,
          priorityScore,
          priorityLabel: getAiLeadPriorityLabel(priorityScore),
        }
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)

    return {
      kind: "ready",
      metrics,
      items,
    }
  } catch (error) {
    console.error("Critical error in AiLeadsPage:", error)
    return { kind: "load_error" }
  }
}

function AiLeadQueueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leads IA</h1>
          <p className="text-muted-foreground">
            Fila operacional das sessões de pré-atendimento IA em andamento e em handoff.
          </p>
        </div>
      </div>

      {children}
    </div>
  )
}
