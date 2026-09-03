import type { SupabaseClient } from "@supabase/supabase-js"

import { isMissingAiSchemaErrorMessage } from "@/lib/ai-leads/schema-guards"
import type { Database } from "@/lib/supabase/database.types"

export type AiLeadOperationsMetrics = {
  openedToday: number
  qualifiedToday: number
  handoffsToday: number
  avgHandoffMinutes: number | null
}

type LoadAiLeadMetricsResult = {
  metrics: AiLeadOperationsMetrics
  schemaAvailable: boolean
}

function startOfTodayIso() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

function defaultMetrics(): AiLeadOperationsMetrics {
  return {
    openedToday: 0,
    qualifiedToday: 0,
    handoffsToday: 0,
    avgHandoffMinutes: null,
  }
}

export async function loadAiLeadOperationsMetrics(
  supabase: SupabaseClient<Database>,
  organizationId: string | null | undefined
): Promise<LoadAiLeadMetricsResult> {
  if (!organizationId) {
    return { metrics: defaultMetrics(), schemaAvailable: true }
  }

  const todayIso = startOfTodayIso()

  const [openedResult, qualifiedResult, handoffsResult, averageRowsResult] = await Promise.all([
    supabase
      .from("ai_lead_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("started_at", todayIso),
    supabase
      .from("ai_lead_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("qualified_at", "is", null)
      .gte("qualified_at", todayIso),
    supabase
      .from("ai_lead_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("handoff_completed_at", "is", null)
      .gte("handoff_completed_at", todayIso),
    supabase
      .from("ai_lead_sessions")
      .select("started_at, handoff_completed_at")
      .eq("organization_id", organizationId)
      .not("handoff_completed_at", "is", null)
      .gte("handoff_completed_at", todayIso),
  ])

  const firstError =
    openedResult.error ?? qualifiedResult.error ?? handoffsResult.error ?? averageRowsResult.error ?? null

  if (firstError) {
    const message =
      `${firstError.code ?? ""} ${firstError.message ?? ""} ${firstError.details ?? ""} ${firstError.hint ?? ""}`.trim()
    if (isMissingAiSchemaErrorMessage(message)) {
      return { metrics: defaultMetrics(), schemaAvailable: false }
    }

    console.error("Error loading ai lead operations metrics:", firstError)
    return { metrics: defaultMetrics(), schemaAvailable: true }
  }

  const handoffRows = averageRowsResult.data ?? []
  const averageMinutes =
    handoffRows.length > 0
      ? Math.round(
          handoffRows.reduce((total, row) => {
            const startedAt = new Date(row.started_at).getTime()
            const handoffAt = row.handoff_completed_at ? new Date(row.handoff_completed_at).getTime() : startedAt
            return total + Math.max(0, handoffAt - startedAt)
          }, 0) /
            handoffRows.length /
            60000
        )
      : null

  return {
    schemaAvailable: true,
    metrics: {
      openedToday: openedResult.count ?? 0,
      qualifiedToday: qualifiedResult.count ?? 0,
      handoffsToday: handoffsResult.count ?? 0,
      avgHandoffMinutes: averageMinutes,
    },
  }
}
