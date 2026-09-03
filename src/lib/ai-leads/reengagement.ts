import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { sendAiWhatsAppMessage } from "@/lib/ai-leads/engine"

type SessionRow = Database["public"]["Tables"]["ai_lead_sessions"]["Row"]
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"]
type ReengagementRow = Database["public"]["Tables"]["ai_lead_reengagements"]["Row"]
type SettingsRow = Database["public"]["Tables"]["ai_lead_reengagement_settings"]["Row"]

type ReengagementReason =
  | "no_reply_after_first_message"
  | "qualified_without_human_action"
  | "handoff_without_human_action"

export type AiLeadReengagementSettings = {
  enabled: boolean
  firstDelayMinutes: number
  secondDelayMinutes: number
  thirdDelayMinutes: number
  inactiveMessageTemplate: string
  handoffMessageTemplate: string
  slaMinutes: number
  finalEscalationDelayMinutes: number
  notifyBroker: boolean
  notifyManager: boolean
}

export type AiLeadReengagementSummary = {
  checked: number
  started: number
  attempted: number
  stopped: number
  escalated: number
}

type SessionCandidate = SessionRow & {
  contacts: Pick<ContactRow, "id" | "name" | "phone" | "assigned_to"> | null
}

const DEFAULT_SETTINGS: AiLeadReengagementSettings = {
  enabled: false,
  firstDelayMinutes: 15,
  secondDelayMinutes: 120,
  thirdDelayMinutes: 1440,
  inactiveMessageTemplate:
    "Olá {{first_name}}, seguimos por aqui para te ajudar com sua busca. Se quiser, posso retomar seu atendimento agora.",
  handoffMessageTemplate:
    "Olá {{first_name}}, seu atendimento segue em andamento por aqui. Se quiser continuar agora, me responda nesta conversa.",
  slaMinutes: 30,
  finalEscalationDelayMinutes: 30,
  notifyBroker: true,
  notifyManager: true,
}

function nowIso() {
  return new Date().toISOString()
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

function normalizeMessageTemplate(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed || DEFAULT_SETTINGS.inactiveMessageTemplate
}

function firstName(name: string | null | undefined) {
  const trimmed = typeof name === "string" ? name.trim() : ""
  return trimmed ? trimmed.split(/\s+/)[0] ?? trimmed : "cliente"
}

function applyTemplate(template: string, contactName: string | null | undefined) {
  const name = (contactName || "").trim()
  const safeFirstName = firstName(contactName)

  return normalizeMessageTemplate(template)
    .replaceAll("{{first_name}}", safeFirstName)
    .replaceAll("{{name}}", name || safeFirstName)
    .trim()
}

export function isAiReengagementSchemaError(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : String(error || "")

  return /ai_lead_reengagements|ai_lead_reengagement_settings|PGRST205|42P01|42703/i.test(message)
}

export async function loadAiLeadReengagementSettings(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<{ schemaAvailable: boolean; settings: AiLeadReengagementSettings }> {
  const { data, error } = await supabase
    .from("ai_lead_reengagement_settings")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    if (isAiReengagementSchemaError(error)) {
      return { schemaAvailable: false, settings: DEFAULT_SETTINGS }
    }
    throw error
  }

  const row = data as SettingsRow | null
  return {
    schemaAvailable: true,
    settings: {
      enabled: row?.enabled ?? DEFAULT_SETTINGS.enabled,
      firstDelayMinutes: row?.first_delay_minutes ?? DEFAULT_SETTINGS.firstDelayMinutes,
      secondDelayMinutes: row?.second_delay_minutes ?? DEFAULT_SETTINGS.secondDelayMinutes,
      thirdDelayMinutes: row?.third_delay_minutes ?? DEFAULT_SETTINGS.thirdDelayMinutes,
      inactiveMessageTemplate: normalizeMessageTemplate(
        row?.inactive_message_template || row?.message_template
      ),
      handoffMessageTemplate: normalizeMessageTemplate(
        row?.handoff_message_template || row?.message_template
      ),
      slaMinutes: row?.sla_minutes ?? DEFAULT_SETTINGS.slaMinutes,
      finalEscalationDelayMinutes:
        row?.final_escalation_delay_minutes ?? DEFAULT_SETTINGS.finalEscalationDelayMinutes,
      notifyBroker: row?.notify_broker ?? DEFAULT_SETTINGS.notifyBroker,
      notifyManager: row?.notify_manager ?? DEFAULT_SETTINGS.notifyManager,
    },
  }
}

function getReasonFromSession(session: SessionRow): ReengagementReason | null {
  if (session.status === "active") {
    return "no_reply_after_first_message"
  }

  if (session.status === "qualified") {
    return "qualified_without_human_action"
  }

  if (session.status === "handoff_requested") {
    return "handoff_without_human_action"
  }

  return null
}

function getAnchorTimestamp(session: SessionRow, reason: ReengagementReason) {
  if (reason === "no_reply_after_first_message") {
    return session.last_message_at || session.started_at
  }

  if (reason === "qualified_without_human_action") {
    return session.qualified_at || session.updated_at || session.started_at
  }

  return session.handoff_requested_at || session.updated_at || session.started_at
}

async function countAiInboundMessages(
  supabase: SupabaseClient<Database>,
  sessionId: string
) {
  const { count, error } = await supabase
    .from("ai_lead_messages")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("direction", "inbound")

  if (error) throw error
  return count ?? 0
}

async function hasContactInboundSince(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  contactId: string,
  sinceIso: string
) {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("direction", "in")
    .gte("created_at", sinceIso)

  if (error) throw error
  return (count ?? 0) > 0
}

async function hasHumanWhatsAppActionSince(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  contactId: string,
  sinceIso: string
) {
  const [{ count: apiCount, error: apiError }, { data: outboundMessages, error: outboundError }, { data: aiOutbound, error: aiOutboundError }] =
    await Promise.all([
      supabase
        .from("contact_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .eq("source", "whatsapp_api")
        .gte("created_at", sinceIso),
      supabase
        .from("messages")
        .select("id, channel, created_at")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .eq("direction", "out")
        .in("channel", ["whatsapp_official", "whatsapp_official_sandbox"])
        .gte("created_at", sinceIso),
      supabase
        .from("ai_lead_messages")
        .select("payload_json, created_at")
        .eq("organization_id", organizationId)
        .eq("direction", "outbound")
        .eq("author", "ai")
        .gte("created_at", sinceIso),
    ])

  if (apiError) throw apiError
  if (outboundError) throw outboundError
  if (aiOutboundError) throw aiOutboundError

  if ((apiCount ?? 0) > 0) return true

  const aiMessageIds = new Set(
    ((aiOutbound ?? []) as Array<{ payload_json?: { message_id?: string | null } | null }>)
      .map((row) => row.payload_json?.message_id || null)
      .filter((value): value is string => Boolean(value))
  )

  const hasHumanOutbound = ((outboundMessages ?? []) as Array<{ id: string }>).some(
    (message) => !aiMessageIds.has(message.id)
  )

  if (hasHumanOutbound) return true

  const { count, error } = await supabase
    .from("contact_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .in("source", ["whatsapp_api", "dashboard", "system"])
    .gte("created_at", sinceIso)

  if (error) throw error
  return (count ?? 0) > 0
}

async function shouldStopReengagement(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  reengagement: ReengagementRow,
  session: SessionRow
) {
  if (session.status === "paused") return "ai_session_paused"
  if (session.status === "closed") return "ai_session_closed"
  if (session.status === "handoff_completed") return "handoff_completed"

  const sinceIso = reengagement.last_attempt_at || reengagement.created_at
  const [hasInbound, hasHumanAction] = await Promise.all([
    hasContactInboundSince(supabase, organizationId, reengagement.contact_id, sinceIso),
    hasHumanWhatsAppActionSince(supabase, organizationId, reengagement.contact_id, sinceIso),
  ])

  if (hasInbound) return "lead_replied"
  if (hasHumanAction) return "human_action_detected"
  return null
}

function getDelays(settings: AiLeadReengagementSettings) {
  return [settings.firstDelayMinutes, settings.secondDelayMinutes, settings.thirdDelayMinutes]
}

function getTemplateByReason(settings: AiLeadReengagementSettings, reason: ReengagementReason) {
  if (reason === "no_reply_after_first_message") {
    return settings.inactiveMessageTemplate
  }

  return settings.handoffMessageTemplate
}

function getAttemptMessage(
  settings: AiLeadReengagementSettings,
  reason: ReengagementReason,
  contactName: string | null | undefined,
  attemptNumber: number
) {
  const base = applyTemplate(getTemplateByReason(settings, reason), contactName)

  if (attemptNumber <= 1) return base
  if (attemptNumber === 2) {
    return `${base} Se fizer sentido, me responda por aqui que seguimos juntos.`
  }

  return `${base} Se ainda quiser continuar, me responda nesta conversa e priorizamos seu atendimento.`
}

function getNotificationRecipients(
  notifyBroker: boolean,
  notifyManager: boolean,
  brokerId: string | null | undefined,
  managers: Array<{ id: string }>
) {
  const recipients = new Set<string>()

  if (notifyBroker && brokerId) {
    recipients.add(brokerId)
  }

  if (notifyManager) {
    for (const manager of managers) recipients.add(manager.id)
  }

  return Array.from(recipients)
}

async function escalateReengagement(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  reengagement: ReengagementRow,
  session: SessionRow,
  contact: Pick<ContactRow, "id" | "name" | "assigned_to">,
  settings: AiLeadReengagementSettings
) {
  const insertedAt = nowIso()
  await supabase
    .from("ai_lead_reengagements")
    .update({
      status: "escalated",
      escalated_at: insertedAt,
      next_attempt_at: null,
      updated_at: insertedAt,
    })
    .eq("id", reengagement.id)

  const { data: managers, error: managersError } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .in("role", ["owner", "manager"])

  if (managersError) throw managersError

  const recipients = getNotificationRecipients(
    settings.notifyBroker,
    settings.notifyManager,
    session.assigned_to_at_handoff || contact.assigned_to || null,
    (managers ?? []) as Array<{ id: string }>
  )

  if (recipients.length > 0) {
    const title =
      reengagement.reason === "no_reply_after_first_message"
        ? "Lead IA sem resposta apos retomada"
        : "Lead IA parado sem acao humana"
    const body =
      reengagement.reason === "no_reply_after_first_message"
        ? `O lead ${contact.name || "sem nome"} nao respondeu apos 3 tentativas de retomada automatica.`
        : `O lead ${contact.name || "sem nome"} segue parado apos 3 tentativas de retomada e precisa de acao operacional.`

    await supabase.from("notifications").insert(
      recipients.map((userId) => ({
        user_id: userId,
        organization_id: organizationId,
        type: "ai_reengagement",
        title,
        body,
        link: `/contacts/${contact.id}`,
      }))
    )
  }

  await supabase.from("contact_events").insert({
    organization_id: organizationId,
    contact_id: contact.id,
    type: "note_added",
    source: "ai_leads",
    payload: {
      action: "ai_reengagement_escalated",
      reengagement_id: reengagement.id,
      session_id: session.id,
      reason: reengagement.reason,
      text: "Cadencia automatica esgotada; alerta interno criado para corretor e gestores.",
    },
    created_at: insertedAt,
  })
}

async function createReengagement(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  session: SessionRow,
  contact: Pick<ContactRow, "id" | "name" | "phone" | "assigned_to">,
  settings: AiLeadReengagementSettings,
  reason: ReengagementReason
) {
  const insertedAt = nowIso()
  const anchor = getAnchorTimestamp(session, reason)
  const nextAttemptAt =
    reason === "no_reply_after_first_message"
      ? addMinutes(anchor, settings.firstDelayMinutes)
      : addMinutes(anchor, settings.slaMinutes)

  const { data, error } = await supabase
    .from("ai_lead_reengagements")
    .insert({
      organization_id: organizationId,
      session_id: session.id,
      contact_id: contact.id,
      reason,
      status: "scheduled",
      attempt_count: 0,
      max_attempts: 3,
      next_attempt_at: nextAttemptAt,
      updated_at: insertedAt,
    })
    .select("*")
    .single()

  if (error) throw error

  await supabase.from("contact_events").insert({
    organization_id: organizationId,
    contact_id: contact.id,
    type: "note_added",
    source: "ai_leads",
    payload: {
      action: "ai_reengagement_started",
      reengagement_id: data.id,
      session_id: session.id,
      reason,
      text: "Cadencia automatica de retomada iniciada para este lead.",
    },
    created_at: insertedAt,
  })

  return data as ReengagementRow
}

async function attemptReengagement(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  session: SessionRow,
  contact: Pick<ContactRow, "id" | "name" | "phone" | "assigned_to">,
  reengagement: ReengagementRow,
  settings: AiLeadReengagementSettings
) {
  const delays = getDelays(settings)
  const insertedAt = nowIso()
  const nextAttemptNumber = reengagement.attempt_count + 1
  const templateMessage = getAttemptMessage(
    settings,
    reengagement.reason as ReengagementReason,
    contact.name,
    nextAttemptNumber
  )

  const sendResult = await sendAiWhatsAppMessage(
    supabase,
    organizationId,
    contact,
    session.id,
    templateMessage
  )

  if (!sendResult.success) {
    await supabase
      .from("ai_lead_reengagements")
      .update({
        status: "stopped",
        stopped_reason: `send_failed:${sendResult.error}`,
        updated_at: insertedAt,
      })
      .eq("id", reengagement.id)

    return { attempted: false, escalated: false, stopped: true }
  }

  const nextAttemptAt =
    nextAttemptNumber >= reengagement.max_attempts
      ? addMinutes(insertedAt, settings.finalEscalationDelayMinutes)
      : addMinutes(insertedAt, delays[Math.min(nextAttemptNumber, delays.length - 1)] ?? settings.slaMinutes)

  await supabase
    .from("ai_lead_reengagements")
    .update({
      attempt_count: nextAttemptNumber,
      last_attempt_at: insertedAt,
      last_attempt_message: templateMessage,
      next_attempt_at: nextAttemptAt,
      status: "waiting_response",
      updated_at: insertedAt,
    })
    .eq("id", reengagement.id)

  await supabase.from("contact_events").insert({
    organization_id: organizationId,
    contact_id: contact.id,
    type: "note_added",
    source: "ai_leads",
    payload: {
      action: "ai_reengagement_attempt_sent",
      reengagement_id: reengagement.id,
      session_id: session.id,
      attempt_number: nextAttemptNumber,
      reason: reengagement.reason,
      text: `Retomada automatica ${nextAttemptNumber}/${reengagement.max_attempts} enviada pela IA.`,
    },
    created_at: insertedAt,
  })

  return { attempted: true, escalated: false, stopped: false }
}

export async function processAiLeadReengagementsForOrganization(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  limit = 100
): Promise<{ success: true; data: AiLeadReengagementSummary } | { success: false; error: string }> {
  try {
    const settingsResult = await loadAiLeadReengagementSettings(supabase, organizationId)
    if (!settingsResult.schemaAvailable) {
      return { success: false, error: "Migração pendente da cadência de retomada IA." }
    }

    const settings = settingsResult.settings
    if (!settings.enabled) {
      return {
        success: true,
        data: { checked: 0, started: 0, attempted: 0, stopped: 0, escalated: 0 },
      }
    }

    const { data: sessionRows, error: sessionsError } = await supabase
      .from("ai_lead_sessions")
      .select("*, contacts!ai_lead_sessions_contact_id_fkey(id, name, phone, assigned_to)")
      .eq("organization_id", organizationId)
      .in("status", ["active", "qualified", "handoff_requested", "paused", "handoff_completed"])
      .order("updated_at", { ascending: true })
      .limit(limit)

    if (sessionsError) throw sessionsError

    const sessions = (sessionRows ?? []) as SessionCandidate[]
    if (sessions.length === 0) {
      return {
        success: true,
        data: { checked: 0, started: 0, attempted: 0, stopped: 0, escalated: 0 },
      }
    }

    const sessionIds = sessions.map((session) => session.id)
    const { data: reengagementRows, error: reengagementsError } = await supabase
      .from("ai_lead_reengagements")
      .select("*")
      .eq("organization_id", organizationId)
      .in("session_id", sessionIds)
      .in("status", ["scheduled", "running", "waiting_response"])

    if (reengagementsError) throw reengagementsError

    const activeReengagements = new Map<string, ReengagementRow>(
      ((reengagementRows ?? []) as ReengagementRow[]).map((row) => [row.session_id, row])
    )

    const summary: AiLeadReengagementSummary = {
      checked: sessions.length,
      started: 0,
      attempted: 0,
      stopped: 0,
      escalated: 0,
    }

    const currentIso = nowIso()

    for (const session of sessions) {
      const contact = session.contacts
      if (!contact) continue

      let reengagement = activeReengagements.get(session.id) ?? null
      const reason = getReasonFromSession(session)

      if (!reason) {
        if (reengagement) {
          await supabase
            .from("ai_lead_reengagements")
            .update({
              status: "stopped",
              stopped_reason: "session_no_longer_eligible",
              updated_at: currentIso,
            })
            .eq("id", reengagement.id)
          summary.stopped += 1
        }
        continue
      }

      if (reason === "no_reply_after_first_message") {
        const inboundCount = await countAiInboundMessages(supabase, session.id)
        if (inboundCount > 0) {
          if (reengagement) {
            await supabase
              .from("ai_lead_reengagements")
              .update({
                status: "stopped",
                stopped_reason: "lead_replied",
                updated_at: currentIso,
              })
              .eq("id", reengagement.id)
            summary.stopped += 1
          }
          continue
        }
      }

      if (!reengagement) {
        reengagement = await createReengagement(supabase, organizationId, session, contact, settings, reason)
        activeReengagements.set(session.id, reengagement)
        summary.started += 1
      }

      const stopReason = await shouldStopReengagement(supabase, organizationId, reengagement, session)
      if (stopReason) {
        await supabase
          .from("ai_lead_reengagements")
          .update({
            status: "stopped",
            stopped_reason: stopReason,
            next_attempt_at: null,
            updated_at: currentIso,
          })
          .eq("id", reengagement.id)
        summary.stopped += 1
        continue
      }

      if (reengagement.next_attempt_at && reengagement.next_attempt_at > currentIso) {
        continue
      }

      if (reengagement.attempt_count >= reengagement.max_attempts) {
        await escalateReengagement(supabase, organizationId, reengagement, session, contact, settings)
        summary.escalated += 1
        continue
      }

      const result = await attemptReengagement(supabase, organizationId, session, contact, reengagement, settings)
      if (result.attempted) summary.attempted += 1
      if (result.stopped) summary.stopped += 1
      if (result.escalated) summary.escalated += 1
    }

    return { success: true, data: summary }
  } catch (error) {
    console.error("Unexpected processAiLeadReengagementsForOrganization error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao processar a cadencia de retomada IA.",
    }
  }
}
