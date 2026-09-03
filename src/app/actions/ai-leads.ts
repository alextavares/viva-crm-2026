"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdmin, type ActionResult } from "@/lib/types"
import {
  completeAiTakeover,
  createAiLeadSession,
  getActiveAiSession,
  getLatestAiSession,
  isAiEligibleContact,
  processAiInboundReply,
  requestAiHandoff,
  setAiSessionPaused,
} from "@/lib/ai-leads/engine"
import {
  loadAiLeadReengagementSettings,
  processAiLeadReengagementsForOrganization,
  type AiLeadReengagementSummary,
} from "@/lib/ai-leads/reengagement"

const contactIdSchema = z.string().uuid("Contato inválido.")
const sessionIdSchema = z.string().uuid("Sessão IA inválida.")
const aiReengagementSettingsSchema = z.object({
  enabled: z.boolean(),
  firstDelayMinutes: z.coerce.number().int().min(1).max(10080),
  secondDelayMinutes: z.coerce.number().int().min(1).max(10080),
  thirdDelayMinutes: z.coerce.number().int().min(1).max(10080),
  inactiveMessageTemplate: z.string().trim().min(1, "Informe a mensagem para lead inativo.").max(2000),
  handoffMessageTemplate: z.string().trim().min(1, "Informe a mensagem para handoff atrasado.").max(2000),
  slaMinutes: z.coerce.number().int().min(1).max(10080),
  finalEscalationDelayMinutes: z.coerce.number().int().min(1).max(10080),
  notifyBroker: z.boolean(),
  notifyManager: z.boolean(),
})
const inboundMessageSchema = z.object({
  sessionId: sessionIdSchema,
  message: z.string().trim().min(1, "Mensagem inválida.").max(4096, "Mensagem longa demais."),
})

type ContactContext =
  | { error: string }
  | {
      admin: ReturnType<typeof createAdminClient>
      authSupabase: Awaited<ReturnType<typeof createClient>>
      organizationId: string
      userId: string
      role: string
      contact: {
        id: string
        organization_id: string
        name: string
        phone: string | null
        type: string | null
        status: string | null
        assigned_to: string | null
        handoff_to_profile_id: string | null
        city: string | null
        interest_type: string | null
        interest_neighborhoods: string[] | null
        interest_price_max: number | null
      }
    }

function revalidateAiLeadPaths(contactId: string) {
  revalidatePath("/contacts")
  revalidatePath(`/contacts/${contactId}`)
  revalidatePath("/dashboard")
  revalidatePath("/ai-leads")
  revalidatePath("/settings")
  revalidatePath("/settings/whatsapp-addon")
}

async function getAiLeadContext(contactId: string): Promise<ContactContext> {
  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return { error: "Não autenticado." }
  }

  const { data: profile, error: profileError } = await authSupabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    return { error: "Sem permissão para operar o pré-atendimento IA." }
  }

  const { data: contact, error: contactError } = await authSupabase
    .from("contacts")
    .select(
      "id, organization_id, name, phone, type, status, assigned_to, handoff_to_profile_id, city, interest_type, interest_neighborhoods, interest_price_max"
    )
    .eq("organization_id", profile.organization_id)
    .eq("id", contactId)
    .maybeSingle()

  if (contactError) {
    return { error: contactError.message }
  }

  if (!contact) {
    return { error: "Contato não encontrado." }
  }

  const canAdmin = isAdmin(profile.role)
  const canAssignedBroker =
    profile.role === "broker" &&
    (contact.assigned_to === user.id || contact.handoff_to_profile_id === user.id)

  if (!canAdmin && !canAssignedBroker) {
    return { error: "Sem permissão para operar este lead com IA." }
  }

  return {
    admin: createAdminClient(),
    authSupabase,
    organizationId: profile.organization_id,
    userId: user.id,
    role: profile.role,
    contact,
  }
}

export async function startAiLeadSession(
  rawContactId: string
): Promise<ActionResult<{ sessionId: string; created: boolean; sendMode?: "sandbox" | "live" }>> {
  const parsed = contactIdSchema.safeParse(rawContactId)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Contato inválido." }
  }

  const ctx = await getAiLeadContext(parsed.data)
  if ("error" in ctx) {
    return { success: false, error: ctx.error }
  }

  try {
    if (!isAiEligibleContact(ctx.contact)) {
      return {
        success: false,
        error: "Este contato não é elegível para pré-atendimento IA no WhatsApp.",
      }
    }

    const result = await createAiLeadSession(ctx.admin, ctx.organizationId, {
      ...ctx.contact,
      created_at: null,
      updated_at: null,
      email: null,
      notes: null,
      ai_status: null,
      ai_score: null,
      ai_last_summary: null,
      qualified_by_ai_at: null,
      handoff_at: null,
      organization_id: ctx.contact.organization_id,
      deal_stage: null,
      interest_bedrooms: null,
      handoff_to_profile_id: ctx.contact.handoff_to_profile_id,
      id: ctx.contact.id,
    })

    if (result.sendResult && !result.sendResult.success) {
      revalidateAiLeadPaths(ctx.contact.id)
      return {
        success: false,
        error: `Sessão IA criada, mas a primeira mensagem falhou: ${result.sendResult.error}`,
      }
    }

    revalidateAiLeadPaths(ctx.contact.id)
    return {
      success: true,
      data: {
        sessionId: result.session.id,
        created: result.created,
        sendMode: result.sendResult?.success ? result.sendResult.mode : undefined,
      },
    }
  } catch (error) {
    console.error("Unexpected startAiLeadSession error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao iniciar o pré-atendimento IA.",
    }
  }
}

export async function processAiInboundMessage(
  rawInput: z.input<typeof inboundMessageSchema>
): Promise<ActionResult<{ qualified: boolean; summary: string | null }>> {
  const parsed = inboundMessageSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Mensagem inválida." }
  }

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Não autenticado." }
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id || !isAdmin(profile.role)) {
    return { success: false, error: "Apenas gestores podem processar respostas da IA manualmente." }
  }

  const admin = createAdminClient()
  try {
    const { data: session, error: sessionError } = await admin
      .from("ai_lead_sessions")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("id", parsed.data.sessionId)
      .maybeSingle()

    if (sessionError) {
      return { success: false, error: sessionError.message }
    }
    if (!session) {
      return { success: false, error: "Sessão IA não encontrada." }
    }

    const { data: contact, error: contactError } = await admin
      .from("contacts")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("id", session.contact_id)
      .maybeSingle()

    if (contactError) {
      return { success: false, error: contactError.message }
    }
    if (!contact) {
      return { success: false, error: "Contato da sessão IA não encontrado." }
    }

    const result = await processAiInboundReply(admin, profile.organization_id, session, contact, parsed.data.message)
    revalidateAiLeadPaths(contact.id)

    if (!result.success) {
      return { success: false, error: result.error }
    }

    return {
      success: true,
      data: {
        qualified: result.qualified,
        summary: result.summary ?? null,
      },
    }
  } catch (error) {
    console.error("Unexpected processAiInboundMessage error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar a resposta da IA.",
    }
  }
}

export async function requestAiLeadHandoffAction(
  rawSessionId: string
): Promise<ActionResult<{ brokerId: string; mode: "existing_owner" | "round_robin" }>> {
  const parsed = sessionIdSchema.safeParse(rawSessionId)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Sessão inválida." }
  }

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Não autenticado." }
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id || !isAdmin(profile.role)) {
    return { success: false, error: "Apenas gestores podem solicitar handoff da IA." }
  }

  const admin = createAdminClient()
  try {
    const { data: session, error: sessionError } = await admin
      .from("ai_lead_sessions")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("id", parsed.data)
      .maybeSingle()

    if (sessionError) {
      return { success: false, error: sessionError.message }
    }
    if (!session) {
      return { success: false, error: "Sessão IA não encontrada." }
    }

    const { data: contact, error: contactError } = await admin
      .from("contacts")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .eq("id", session.contact_id)
      .maybeSingle()

    if (contactError) {
      return { success: false, error: contactError.message }
    }
    if (!contact) {
      return { success: false, error: "Contato da sessão IA não encontrado." }
    }

    const result = await requestAiHandoff(admin, profile.organization_id, session, contact)
    revalidateAiLeadPaths(contact.id)

    if (!result.success) {
      return { success: false, error: result.error }
    }

    return {
      success: true,
      data: {
        brokerId: result.brokerId,
        mode: result.mode,
      },
    }
  } catch (error) {
    console.error("Unexpected requestAiLeadHandoffAction error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao solicitar handoff da IA.",
    }
  }
}

export async function takeOverAiConversation(
  rawContactId: string
): Promise<ActionResult<{ sessionId: string }>> {
  const parsed = contactIdSchema.safeParse(rawContactId)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Contato inválido." }
  }

  const ctx = await getAiLeadContext(parsed.data)
  if ("error" in ctx) {
    return { success: false, error: ctx.error }
  }

  try {
    const session = await getLatestAiSession(ctx.admin, ctx.organizationId, ctx.contact.id)
    if (!session) {
      return { success: false, error: "Este contato ainda não possui sessão IA." }
    }

    await completeAiTakeover(ctx.admin, ctx.organizationId, session, {
      ...ctx.contact,
      created_at: null,
      updated_at: null,
      email: null,
      notes: null,
      ai_status: null,
      ai_score: null,
      ai_last_summary: null,
      qualified_by_ai_at: null,
      handoff_at: null,
      organization_id: ctx.contact.organization_id,
      deal_stage: null,
      interest_bedrooms: null,
      handoff_to_profile_id: ctx.contact.handoff_to_profile_id,
      id: ctx.contact.id,
    }, ctx.userId)

    revalidateAiLeadPaths(ctx.contact.id)
    return { success: true, data: { sessionId: session.id } }
  } catch (error) {
    console.error("Unexpected takeOverAiConversation error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao assumir a conversa da IA.",
    }
  }
}

export async function pauseAiLeadSession(
  rawContactId: string
): Promise<ActionResult<{ sessionId: string; paused: boolean }>> {
  return setAiPauseState(rawContactId, true)
}

export async function resumeAiLeadSession(
  rawContactId: string
): Promise<ActionResult<{ sessionId: string; paused: boolean }>> {
  return setAiPauseState(rawContactId, false)
}

async function setAiPauseState(
  rawContactId: string,
  paused: boolean
): Promise<ActionResult<{ sessionId: string; paused: boolean }>> {
  const parsed = contactIdSchema.safeParse(rawContactId)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Contato inválido." }
  }

  const ctx = await getAiLeadContext(parsed.data)
  if ("error" in ctx) {
    return { success: false, error: ctx.error }
  }

  try {
    const session = await getActiveAiSession(ctx.admin, ctx.organizationId, ctx.contact.id)
    if (!session) {
      return { success: false, error: "Nenhuma sessão IA ativa para este contato." }
    }

    await setAiSessionPaused(ctx.admin, ctx.organizationId, session, ctx.contact.id, paused)
    revalidateAiLeadPaths(ctx.contact.id)

    return {
      success: true,
      data: {
        sessionId: session.id,
        paused,
      },
    }
  } catch (error) {
    console.error("Unexpected setAiPauseState error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao atualizar o estado da sessão IA.",
    }
  }
}

export async function saveAiReengagementSettings(
  rawInput: z.input<typeof aiReengagementSettingsSchema>
): Promise<ActionResult> {
  const parsed = aiReengagementSettingsSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos para a cadência de retomada IA.",
    }
  }

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Não autenticado." }
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id || !isAdmin(profile.role)) {
    return { success: false, error: "Apenas gestores podem alterar a cadência de retomada IA." }
  }

  try {
    const admin = createAdminClient()
    const settingsResult = await loadAiLeadReengagementSettings(admin, profile.organization_id)
    if (!settingsResult.schemaAvailable) {
      return { success: false, error: "Migração pendente para cadência de retomada IA." }
    }

    const { error } = await admin.from("ai_lead_reengagement_settings").upsert({
      organization_id: profile.organization_id,
      enabled: parsed.data.enabled,
      first_delay_minutes: parsed.data.firstDelayMinutes,
      second_delay_minutes: parsed.data.secondDelayMinutes,
      third_delay_minutes: parsed.data.thirdDelayMinutes,
      message_template: parsed.data.inactiveMessageTemplate.trim(),
      inactive_message_template: parsed.data.inactiveMessageTemplate.trim(),
      handoff_message_template: parsed.data.handoffMessageTemplate.trim(),
      sla_minutes: parsed.data.slaMinutes,
      final_escalation_delay_minutes: parsed.data.finalEscalationDelayMinutes,
      notify_broker: parsed.data.notifyBroker,
      notify_manager: parsed.data.notifyManager,
      updated_at: new Date().toISOString(),
    })

    if (error) {
      return { success: false, error: error.message || "Erro ao salvar a cadência de retomada IA." }
    }

    revalidatePath("/settings")
    revalidatePath("/settings/whatsapp-addon")
    revalidatePath("/dashboard")
    revalidatePath("/ai-leads")
    return { success: true }
  } catch (error) {
    console.error("Unexpected saveAiReengagementSettings error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao salvar a cadência de retomada IA.",
    }
  }
}

export async function processAiReengagementsNow(
  limit = 50
): Promise<ActionResult<AiLeadReengagementSummary>> {
  const parsedLimit = z.coerce.number().int().min(1).max(500).safeParse(limit)
  if (!parsedLimit.success) {
    return { success: false, error: "Limite inválido para processar a retomada IA." }
  }

  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return { success: false, error: "Não autenticado." }
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id || !isAdmin(profile.role)) {
    return { success: false, error: "Apenas gestores podem processar a retomada IA." }
  }

  try {
    const admin = createAdminClient()
    const result = await processAiLeadReengagementsForOrganization(
      admin,
      profile.organization_id,
      parsedLimit.data
    )

    if (!result.success) {
      return result
    }

    revalidatePath("/dashboard")
    revalidatePath("/ai-leads")
    revalidatePath("/contacts")
    return result
  } catch (error) {
    console.error("Unexpected processAiReengagementsNow error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar a retomada IA.",
    }
  }
}
