"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { isAdmin, type ActionResult } from "@/lib/types"

const goalSettingsSchema = z.object({
  enabled: z.boolean(),
  period_type: z.enum(["weekly", "monthly"]),
  metric_captacoes_enabled: z.boolean(),
  metric_respostas_enabled: z.boolean(),
  metric_visitas_enabled: z.boolean(),
  response_sla_minutes: z.coerce.number().int().min(1).max(1440),
  target_captacoes: z.coerce.number().int().min(0).max(100000),
  target_respostas: z.coerce.number().int().min(0).max(100000),
  target_visitas: z.coerce.number().int().min(0).max(100000),
})

const goalOverrideSchema = z.object({
  profile_id: z.string().uuid("Corretor inválido."),
  enabled: z.boolean(),
  period_type: z.enum(["weekly", "monthly"]).nullable(),
  metric_captacoes_enabled: z.boolean().nullable(),
  metric_respostas_enabled: z.boolean().nullable(),
  metric_visitas_enabled: z.boolean().nullable(),
  response_sla_minutes: z.coerce.number().int().min(1).max(1440).nullable(),
  target_captacoes: z.coerce.number().int().min(0).max(100000).nullable(),
  target_respostas: z.coerce.number().int().min(0).max(100000).nullable(),
  target_visitas: z.coerce.number().int().min(0).max(100000).nullable(),
})

const goalBrokerOverridesSchema = z.object({
  overrides: z.array(goalOverrideSchema),
})

type GoalAdminContext =
  | { supabase: Awaited<ReturnType<typeof createClient>>; error: string }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>
      organizationId: string
    }

async function getGoalAdminContext(): Promise<GoalAdminContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, error: "Não autenticado." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    return { supabase, error: "Sem permissão para alterar metas." }
  }

  if (!isAdmin(profile.role)) {
    return { supabase, error: "Apenas gestores podem alterar metas." }
  }

  return {
    supabase,
    organizationId: profile.organization_id,
  }
}

function refreshGoalSurfaces() {
  revalidatePath("/dashboard")
  revalidatePath("/settings")
  revalidatePath("/settings/goals")
}

export async function saveGoalSettings(
  rawInput: z.input<typeof goalSettingsSchema>
): Promise<ActionResult> {
  const parsed = goalSettingsSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos para salvar metas.",
    }
  }

  const ctx = await getGoalAdminContext()
  if ("error" in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, organizationId } = ctx
  const payload = {
    organization_id: organizationId,
    ...parsed.data,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("goal_settings").upsert(payload)
  if (error) {
    return { success: false, error: error.message }
  }

  refreshGoalSurfaces()
  return { success: true }
}

export async function saveGoalBrokerOverrides(
  rawInput: z.input<typeof goalBrokerOverridesSchema>
): Promise<ActionResult<{ savedCount: number }>> {
  const parsed = goalBrokerOverridesSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos para salvar exceções.",
    }
  }

  const ctx = await getGoalAdminContext()
  if ("error" in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, organizationId } = ctx
  const overrides = parsed.data.overrides

  if (overrides.length > 0) {
    const profileIds = overrides.map((row) => row.profile_id)
    const { data: brokerProfiles, error: brokerProfilesError } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("role", "broker")
      .in("id", profileIds)

    if (brokerProfilesError) {
      return { success: false, error: brokerProfilesError.message }
    }

    const validProfileIds = new Set((brokerProfiles || []).map((row) => row.id))
    const invalidOverride = overrides.find((row) => !validProfileIds.has(row.profile_id))
    if (invalidOverride) {
      return {
        success: false,
        error: "Uma ou mais exceções referenciam corretores inválidos da organização.",
      }
    }
  }

  const { error: clearError } = await supabase
    .from("goal_broker_overrides")
    .delete()
    .eq("organization_id", organizationId)

  if (clearError) {
    return { success: false, error: clearError.message }
  }

  if (overrides.length === 0) {
    refreshGoalSurfaces()
    return { success: true, data: { savedCount: 0 } }
  }

  const payload = overrides.map((row) => ({
    organization_id: organizationId,
    profile_id: row.profile_id,
    enabled: row.enabled,
    period_type: row.period_type,
    metric_captacoes_enabled: row.metric_captacoes_enabled,
    metric_respostas_enabled: row.metric_respostas_enabled,
    metric_visitas_enabled: row.metric_visitas_enabled,
    response_sla_minutes: row.response_sla_minutes,
    target_captacoes: row.target_captacoes,
    target_respostas: row.target_respostas,
    target_visitas: row.target_visitas,
    updated_at: new Date().toISOString(),
  }))

  const { error: insertError } = await supabase.from("goal_broker_overrides").insert(payload)
  if (insertError) {
    return { success: false, error: insertError.message }
  }

  refreshGoalSurfaces()
  return { success: true, data: { savedCount: payload.length } }
}
