"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  isAdmin,
  type ActionResult,
  type TeamSeatUsage,
  type TeamMember,
  type TeamInvite,
  type TeamAuditEvent,
} from "@/lib/types"
import { mapTeamBusinessError } from "@/lib/team/errors"
import { calculateUpgradeProration, computeCurrentBillingCycle, normalizeInterval } from "@/lib/team/billing"
import { brokerPublicProfileSchema, resolvePublicBrokerDisplayName } from "@/lib/team/public-profile"

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type AdminProfileRow = {
  id: string
  organization_id: string
  role: string | null
}

type TeamMemberRow = {
  id: string
  full_name: string | null
  role: string
  is_active: boolean
  avatar_url: string | null
  creci: string | null
  public_whatsapp: string | null
  public_profile_enabled: boolean
  public_display_name: string | null
  created_at: string | null
  updated_at: string | null
}

type BrokerSeatPlanRow = {
  organization_id: string
  broker_seat_limit: number
  billing_cycle_anchor: string
  billing_cycle_interval: string | null
  status: string | null
}

type BrokerSeatPlanChangeRow = {
  id: string
  action: "upgrade" | "downgrade" | string
  status: string
  old_limit: number
  new_limit: number
  effective_at: string
  currency_code: string
  unit_price_cents: number
  prorated_amount_cents: number | null
  proration_days_total: number | null
  proration_days_remaining: number | null
  notes: string | null
  created_at: string
}

// --- Schemas ---

const inviteSchema = z.object({
  email: z.string().email("Email inválido."),
  role: z.enum(["broker", "assistant", "manager"]),
  full_name: z.string().optional().nullable(),
})

const memberStatusSchema = z.object({
  profileId: z.string().uuid("ID de perfil inválido."),
  isActive: z.boolean(),
})

const seatChangeSchema = z.object({
  action: z.enum(["upgrade", "downgrade"]),
  newLimit: z.number().int().min(0, "Limite deve ser positivo."),
  unitPriceCents: z.number().int().min(0).optional(),
  currencyCode: z.string().length(3).optional().default("BRL"),
  notes: z.string().optional().nullable(),
})

// --- Context Helper ---

async function getAdminActionContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, error: "Não autenticado." } as const
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", user.id)
    .single()

  const adminProfile = profile as AdminProfileRow | null

  if (!adminProfile?.organization_id) {
    return { supabase, error: "Sem permissão (perfil não encontrado)." } as const
  }

  if (!isAdmin(adminProfile.role)) {
    return { supabase, error: "Apenas gestores podem executar esta ação." } as const
  }

  return { supabase, user, profile: adminProfile, organizationId: adminProfile.organization_id } as const
}

async function insertAudit(
  supabase: SupabaseServerClient,
  params: {
    organizationId: string
    actorId: string
    action: string
    level: "info" | "warning" | "error"
    message: string
    targetProfileId?: string
    metadata?: Record<string, unknown>
  }
) {
  try {
    await supabase.from("team_audit_events").insert({
      organization_id: params.organizationId,
      actor_profile_id: params.actorId,
      target_profile_id: params.targetProfileId,
      action: params.action,
      level: params.level,
      message: params.message,
      metadata: params.metadata || {},
    })
  } catch {
    // best effort
  }
}

// --- Actions ---

export type TeamSettingsData = {
  usage: TeamSeatUsage
  members: TeamMember[]
  invites: TeamInvite[]
  audit_events: TeamAuditEvent[]
}

export async function loadTeamSettingsData(): Promise<ActionResult<TeamSettingsData>> {
  const ctx = await getAdminActionContext()
  if ("error" in ctx) return { success: false, error: ctx.error ?? "Sem permissão." }
  const { supabase, organizationId } = ctx

  try {
    const [membersRes, usageRes, invitesRes, auditRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, is_active, avatar_url, creci, public_whatsapp, public_profile_enabled, public_display_name, created_at, updated_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }),
      supabase.rpc("get_broker_seat_usage", { p_org_id: organizationId }).single(),
      supabase
        .from("team_invites")
        .select("id, email, role, status, expires_at, created_at")
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("team_audit_events")
        .select("id, action, level, message, metadata, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(20),
    ])

    if (membersRes.error) return { success: false, error: membersRes.error.message }
    if (usageRes.error) return { success: false, error: usageRes.error.message }
    if (invitesRes.error) return { success: false, error: invitesRes.error.message }
    if (auditRes.error) return { success: false, error: auditRes.error.message }

    const members = ((membersRes.data as TeamMemberRow[] | null) || []).map((member) => ({
      id: member.id,
      full_name: member.full_name,
      role: member.role,
      is_active: member.is_active,
      consumes_seat: member.role === "broker" && member.is_active,
      avatar_url: member.avatar_url,
      creci: member.creci,
      public_whatsapp: member.public_whatsapp,
      public_profile_enabled: member.public_profile_enabled,
      public_display_name: member.public_display_name,
      created_at: member.created_at,
      updated_at: member.updated_at,
    }))

    const usage = (usageRes.data ?? { used: 0, seat_limit: 1, available: 1 }) as TeamSeatUsage

    return {
      success: true,
      data: {
        usage,
        members,
        invites: invitesRes.data || [],
        audit_events: auditRes.data || [],
      },
    }
  } catch {
    return { success: false, error: "Falha inesperada ao carregar dados da equipe." }
  }
}

export async function inviteTeamMember(rawInput: z.infer<typeof inviteSchema>): Promise<ActionResult> {
  const ctx = await getAdminActionContext()
  if ("error" in ctx) return { success: false, error: ctx.error ?? "Sem permissão." }
  const { supabase, organizationId, profile: actor } = ctx

  const validation = inviteSchema.safeParse(rawInput)
  if (!validation.success) return { success: false, error: validation.error.issues[0]?.message ?? "Convite inválido." }
  const { email, role, full_name } = validation.data

  try {
    // Check pending
    const { data: existingPending } = await supabase
      .from("team_invites")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .ilike("email", email)
      .maybeSingle()

    if (existingPending) {
      return { success: false, error: "Já existe convite pendente para este email." }
    }

    // Check capacity if broker
    if (role === "broker") {
      const { data: usageData, error: usageError } = await supabase
        .rpc("get_broker_seat_usage", { p_org_id: organizationId })
        .single()
      if (usageError) {
        return { success: false, error: usageError.message }
      }
      const usage = (usageData ?? { used: 0, seat_limit: 0, available: 0 }) as TeamSeatUsage
      if ((usage?.available ?? 0) <= 0) {
        await insertAudit(supabase, {
          organizationId,
          actorId: actor.id,
          action: "invite_blocked_limit",
          level: "warning",
          message: "Limite de corretores do plano atingido.",
          metadata: { email, role },
        })
        return { success: false, error: `Limite de corretores do plano atingido (${usage?.used ?? 0}/${usage?.seat_limit ?? 0}).` }
      }
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: invite, error: inviteErr } = await supabase
      .from("team_invites")
      .insert({
        organization_id: organizationId,
        email,
        role,
        invited_by: actor.id,
        status: "pending",
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (inviteErr) {
      const mapped = mapTeamBusinessError(inviteErr)
      return { success: false, error: mapped.message }
    }

    // Provider invite
    const admin = createAdminClient()
    const { error: providerErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?next=/dashboard`,
      data: { full_name },
    })

    if (providerErr) {
      await supabase.from("team_invites").delete().eq("id", invite.id)
      const mapped = mapTeamBusinessError(providerErr)
      return { success: false, error: mapped.message }
    }

    await insertAudit(supabase, {
      organizationId,
      actorId: actor.id,
      action: "invite_created",
      level: "info",
      message: "Convite de equipe criado com sucesso.",
      metadata: { email, role, invite_id: invite.id },
    })

    revalidatePath("/settings/team")
    return { success: true }
  } catch {
    return { success: false, error: "Erro interno ao processar convite." }
  }
}

export async function updateBrokerMemberStatus(rawInput: z.infer<typeof memberStatusSchema>): Promise<ActionResult> {
  const ctx = await getAdminActionContext()
  if ("error" in ctx) return { success: false, error: ctx.error ?? "Sem permissão." }
  const { supabase, organizationId, profile: actor } = ctx

  const validation = memberStatusSchema.safeParse(rawInput)
  if (!validation.success) return { success: false, error: validation.error.issues[0]?.message ?? "Status inválido." }
  const { profileId, isActive } = validation.data

  try {
    const { data: target } = await supabase
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", profileId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (!target) return { success: false, error: "Corretor não encontrado." }
    if (target.role !== "broker") return { success: false, error: "Apenas corretores podem ter status alterado aqui." }
    if (target.is_active === isActive) return { success: true }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("id", profileId)
      .eq("organization_id", organizationId)

    if (updateErr) {
      const mapped = mapTeamBusinessError(updateErr)
      await insertAudit(supabase, {
        organizationId,
        actorId: actor.id,
        targetProfileId: profileId,
        action: "member_status_update_failed",
        level: "error",
        message: mapped.message,
        metadata: { desired_is_active: isActive },
      })
      return { success: false, error: mapped.message }
    }

    await insertAudit(supabase, {
      organizationId,
      actorId: actor.id,
      targetProfileId: profileId,
      action: isActive ? "member_reactivated" : "member_deactivated",
      level: "info",
      message: isActive ? "Corretor reativado com sucesso." : "Corretor desativado com sucesso.",
    })

    revalidatePath("/settings/team")
    return { success: true }
  } catch {
    return { success: false, error: "Erro interno ao atualizar status." }
  }
}

export async function updateBrokerPublicProfile(
  rawInput: z.infer<typeof brokerPublicProfileSchema>
): Promise<ActionResult> {
  const ctx = await getAdminActionContext()
  if ("error" in ctx) return { success: false, error: ctx.error ?? "Sem permissão." }
  const { supabase, organizationId, profile: actor } = ctx

  const validation = brokerPublicProfileSchema.safeParse(rawInput)
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message ?? "Perfil público inválido." }
  }

  const { profileId, avatar_url, creci, public_display_name, public_profile_enabled, public_whatsapp } =
    validation.data

  try {
    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id, organization_id, role, is_active, full_name")
      .eq("id", profileId)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (targetError) {
      return { success: false, error: targetError.message }
    }

    if (!target) return { success: false, error: "Corretor não encontrado." }
    if (target.role !== "broker") {
      return { success: false, error: "Apenas corretores podem ser exibidos no site público." }
    }

    const resolvedName = resolvePublicBrokerDisplayName(public_display_name, target.full_name)
    if (public_profile_enabled && !resolvedName) {
      return { success: false, error: "Defina um nome público ou o nome do corretor antes de exibir no site." }
    }

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        avatar_url,
        creci,
        public_display_name,
        public_profile_enabled,
        public_whatsapp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId)
      .eq("organization_id", organizationId)

    if (updateErr) {
      const mapped = mapTeamBusinessError(updateErr)
      await insertAudit(supabase, {
        organizationId,
        actorId: actor.id,
        targetProfileId: profileId,
        action: "public_profile_update_failed",
        level: "error",
        message: mapped.message,
        metadata: { public_profile_enabled },
      })
      return { success: false, error: mapped.message }
    }

    await insertAudit(supabase, {
      organizationId,
      actorId: actor.id,
      targetProfileId: profileId,
      action: "public_profile_updated",
      level: "info",
      message: public_profile_enabled
        ? "Perfil público do corretor atualizado e habilitado."
        : "Perfil público do corretor atualizado.",
      metadata: {
        public_profile_enabled,
        public_display_name: resolvedName,
        has_public_whatsapp: Boolean(public_whatsapp),
        has_creci: Boolean(creci),
        is_active: target.is_active,
      },
    })

    const { data: organization } = await supabase
      .from("organizations")
      .select("slug")
      .eq("id", organizationId)
      .maybeSingle()

    revalidatePath("/settings/team")
    revalidatePath("/properties")
    if (organization?.slug) {
      revalidatePath(`/s/${organization.slug}`)
      revalidatePath(`/s/${organization.slug}`, "layout")
    }

    return { success: true }
  } catch {
    return { success: false, error: "Erro interno ao salvar o perfil público." }
  }
}

type BillingCycleData = {
  start: string
  end: string
  interval: string
  total_days: number
  remaining_days: number
}

export type BillingSeatsData = {
  plan: BrokerSeatPlanRow
  usage: TeamSeatUsage
  cycle: BillingCycleData
  pending_change: BrokerSeatPlanChangeRow | null
  history: BrokerSeatPlanChangeRow[]
}

export async function loadBillingSeatsData(): Promise<ActionResult<BillingSeatsData>> {
  const ctx = await getAdminActionContext()
  if ("error" in ctx) return { success: false, error: ctx.error ?? "Sem permissão." }
  const { supabase, organizationId } = ctx

  try {
    const [planRes, usageRes, pendingRes, historyRes] = await Promise.all([
      supabase.from("broker_seat_plans").select("*").eq("organization_id", organizationId).single(),
      supabase.rpc("get_broker_seat_usage", { p_org_id: organizationId }).single(),
      supabase.from("broker_seat_plan_changes").select("*").eq("organization_id", organizationId).eq("status", "scheduled").maybeSingle(),
      supabase.from("broker_seat_plan_changes").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(10),
    ])

    if (planRes.error) return { success: false, error: planRes.error.message }
    if (usageRes.error) return { success: false, error: usageRes.error.message }
    if (pendingRes.error) return { success: false, error: pendingRes.error.message }
    if (historyRes.error) return { success: false, error: historyRes.error.message }

    const plan = planRes.data as BrokerSeatPlanRow
    const usage = usageRes.data as TeamSeatUsage
    const interval = normalizeInterval(plan.billing_cycle_interval)
    const cycle = computeCurrentBillingCycle(plan.billing_cycle_anchor, interval)

    return {
      success: true,
      data: {
        plan,
        usage,
        cycle: {
          start: cycle.start.toISOString(),
          end: cycle.end.toISOString(),
          interval: cycle.interval,
          total_days: cycle.totalDays,
          remaining_days: cycle.remainingDays,
        },
        pending_change: (pendingRes.data as BrokerSeatPlanChangeRow | null) ?? null,
        history: (historyRes.data as BrokerSeatPlanChangeRow[] | null) || [],
      },
    }
  } catch {
    return { success: false, error: "Erro ao carregar dados de cobrança." }
  }
}

export async function applyBrokerSeatPlanChange(rawInput: z.infer<typeof seatChangeSchema>): Promise<ActionResult<{ prorated_amount_cents?: number }>> {
  const ctx = await getAdminActionContext()
  if ("error" in ctx) return { success: false, error: ctx.error ?? "Sem permissão." }
  const { supabase, organizationId, profile: actor } = ctx

  const validation = seatChangeSchema.safeParse(rawInput)
  if (!validation.success) return { success: false, error: validation.error.issues[0]?.message ?? "Alteração de assentos inválida." }
  const { action, newLimit, unitPriceCents = 0, currencyCode, notes } = validation.data

  try {
      const [planRes, usageRes] = await Promise.all([
        supabase.from("broker_seat_plans").select("*").eq("organization_id", organizationId).single(),
        supabase.rpc("get_broker_seat_usage", { p_org_id: organizationId }).single(),
      ])

      if (planRes.error) return { success: false, error: planRes.error.message }
      if (usageRes.error) return { success: false, error: usageRes.error.message }
      const plan = planRes.data as BrokerSeatPlanRow
    const usage = usageRes.data as TeamSeatUsage
    const currentLimit = Number(plan.broker_seat_limit || 0)
    const now = new Date()
    const cycle = computeCurrentBillingCycle(plan.billing_cycle_anchor, plan.billing_cycle_interval, now)

    if (action === "upgrade") {
      if (newLimit <= currentLimit) return { success: false, error: "Upgrade exige novo limite maior que o atual." }

      const proration = calculateUpgradeProration({
        oldLimit: currentLimit,
        newLimit,
        unitPriceCents,
        cycleTotalDays: cycle.totalDays,
        cycleRemainingDays: cycle.remainingDays,
      })

      const { error: updateErr } = await supabase.from("broker_seat_plans").update({ broker_seat_limit: newLimit, updated_at: now.toISOString() }).eq("organization_id", organizationId)
      if (updateErr) return { success: false, error: updateErr.message }

      await supabase.from("broker_seat_plan_changes").insert({
        organization_id: organizationId,
        requested_by: actor.id,
        action: "upgrade",
        status: "applied",
        old_limit: currentLimit,
        new_limit: newLimit,
        effective_at: now.toISOString(),
        currency_code: currencyCode,
        unit_price_cents: proration.unitPriceCents,
        prorated_amount_cents: proration.proratedAmountCents,
        proration_days_total: proration.totalDays,
        proration_days_remaining: proration.remainingDays,
        notes,
      })

      await insertAudit(supabase, {
        organizationId,
        actorId: actor.id,
        action: "seat_upgrade_applied",
        level: "info",
        message: "Upgrade de assentos aplicado com sucesso.",
        metadata: { old_limit: currentLimit, new_limit: newLimit, prorated_amount_cents: proration.proratedAmountCents },
      })

      revalidatePath("/settings/billing")
      return { success: true, data: { prorated_amount_cents: proration.proratedAmountCents } }
    } else {
      // Downgrade
      if (newLimit >= currentLimit) return { success: false, error: "Downgrade exige novo limite menor que o atual." }
      if (usage.used > newLimit) {
        return { success: false, error: `Existem ${usage.used} corretores ativos. Reduza para no máximo ${newLimit} antes do downgrade.` }
      }

      const { data: existing } = await supabase.from("broker_seat_plan_changes").select("id").eq("organization_id", organizationId).eq("status", "scheduled").eq("action", "downgrade").maybeSingle()
      if (existing) return { success: false, error: "Já existe downgrade agendado para este ciclo." }

      await supabase.from("broker_seat_plan_changes").insert({
        organization_id: organizationId,
        requested_by: actor.id,
        action: "downgrade",
        status: "scheduled",
        old_limit: currentLimit,
        new_limit: newLimit,
        effective_at: cycle.end.toISOString(),
        currency_code: currencyCode,
        unit_price_cents: unitPriceCents,
        notes,
      })

      await insertAudit(supabase, {
        organizationId,
        actorId: actor.id,
        action: "seat_downgrade_scheduled",
        level: "info",
        message: "Downgrade de assentos agendado para o próximo ciclo.",
        metadata: { old_limit: currentLimit, new_limit: newLimit, effective_at: cycle.end.toISOString() },
      })

      revalidatePath("/settings/billing")
      return { success: true, data: {} }
    }
  } catch {
    return { success: false, error: "Erro ao processar alteração de assentos." }
  }
}
