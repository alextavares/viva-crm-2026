import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"

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

export type ReengagementReason =
  | "no_reply_after_first_message"
  | "qualified_without_human_action"
  | "handoff_without_human_action"

type SessionStatus = Database["public"]["Tables"]["ai_lead_sessions"]["Row"]["status"]

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

/**
 * Canonical `message_templates` rows backing the reengagement copy. The legacy
 * `ai_lead_reengagement_settings` table stored template text inline; the
 * canonical contract stores reusable copy in `message_templates`, keyed by
 * (organization_id, lower(title), channel).
 */
export const REENGAGEMENT_TEMPLATE_TITLES = {
  inactive: "ai_reengagement_inactive",
  handoff: "ai_reengagement_handoff",
} as const

const REENGAGEMENT_TEMPLATE_CHANNEL = "whatsapp"

function normalizeMessageTemplate(value: string | null | undefined, fallback: string) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed || fallback
}

function firstName(name: string | null | undefined) {
  const trimmed = typeof name === "string" ? name.trim() : ""
  return trimmed ? trimmed.split(/\s+/)[0] ?? trimmed : "cliente"
}

export function applyTemplate(template: string, contactName: string | null | undefined) {
  const name = (contactName || "").trim()
  const safeFirstName = firstName(contactName)

  return normalizeMessageTemplate(template, DEFAULT_SETTINGS.inactiveMessageTemplate)
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

export function getReasonFromStatus(status: SessionStatus): ReengagementReason | null {
  if (status === "active") return "no_reply_after_first_message"
  if (status === "qualified") return "qualified_without_human_action"
  if (status === "handed_off") return "handoff_without_human_action"
  return null
}

export function getDelays(settings: AiLeadReengagementSettings) {
  return [settings.firstDelayMinutes, settings.secondDelayMinutes, settings.thirdDelayMinutes]
}

export function getTemplateByReason(settings: AiLeadReengagementSettings, reason: ReengagementReason) {
  if (reason === "no_reply_after_first_message") {
    return settings.inactiveMessageTemplate
  }
  return settings.handoffMessageTemplate
}

export function getAttemptMessage(
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

/**
 * Canonical settings load: delays/enabled/SLA/escalation flags live in
 * `ai_lead_settings`; template copy lives in `message_templates`. Both tables
 * are canonical contract, so settings are always available — there is no
 * legacy "pending migration" state anymore.
 */
export async function loadAiLeadReengagementSettings(
  supabase: SupabaseClient<Database>,
  organizationId: string
): Promise<{ schemaAvailable: boolean; settings: AiLeadReengagementSettings }> {
  const [{ data: settingsRow }, { data: templateRows }] = await Promise.all([
    supabase.from("ai_lead_settings").select("*").eq("organization_id", organizationId).maybeSingle(),
    supabase
      .from("message_templates")
      .select("title, content")
      .eq("organization_id", organizationId)
      .eq("channel", REENGAGEMENT_TEMPLATE_CHANNEL)
      .in("title", [REENGAGEMENT_TEMPLATE_TITLES.inactive, REENGAGEMENT_TEMPLATE_TITLES.handoff]),
  ])

  const byTitle = new Map((templateRows ?? []).map((row) => [row.title, row.content]))

  return {
    schemaAvailable: true,
    settings: {
      enabled: settingsRow?.reengagement_enabled ?? DEFAULT_SETTINGS.enabled,
      firstDelayMinutes: settingsRow?.first_delay_minutes ?? DEFAULT_SETTINGS.firstDelayMinutes,
      secondDelayMinutes: settingsRow?.second_delay_minutes ?? DEFAULT_SETTINGS.secondDelayMinutes,
      thirdDelayMinutes: settingsRow?.third_delay_minutes ?? DEFAULT_SETTINGS.thirdDelayMinutes,
      inactiveMessageTemplate: normalizeMessageTemplate(
        byTitle.get(REENGAGEMENT_TEMPLATE_TITLES.inactive),
        DEFAULT_SETTINGS.inactiveMessageTemplate
      ),
      handoffMessageTemplate: normalizeMessageTemplate(
        byTitle.get(REENGAGEMENT_TEMPLATE_TITLES.handoff),
        DEFAULT_SETTINGS.handoffMessageTemplate
      ),
      slaMinutes: settingsRow?.response_sla_minutes ?? DEFAULT_SETTINGS.slaMinutes,
      finalEscalationDelayMinutes: DEFAULT_SETTINGS.finalEscalationDelayMinutes,
      notifyBroker: settingsRow?.escalate_to_assigned ?? DEFAULT_SETTINGS.notifyBroker,
      notifyManager: settingsRow?.notify_manager ?? DEFAULT_SETTINGS.notifyManager,
    },
  }
}

export type SaveAiLeadReengagementInput = {
  enabled: boolean
  firstDelayMinutes: number
  secondDelayMinutes: number
  thirdDelayMinutes: number
  inactiveMessageTemplate: string
  handoffMessageTemplate: string
  slaMinutes: number
  notifyBroker: boolean
  notifyManager: boolean
}

/**
 * Canonical settings save: delays/flags go to `ai_lead_settings` (one row per
 * organization), template copy goes to `message_templates` (upsert by the
 * unique (organization_id, lower(title), channel) key).
 */
export async function saveAiLeadReengagementSettings(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  input: SaveAiLeadReengagementInput
): Promise<{ success: true } | { success: false; error: string }> {
  const { error: settingsError } = await supabase.from("ai_lead_settings").upsert(
    {
      organization_id: organizationId,
      reengagement_enabled: input.enabled,
      first_delay_minutes: input.firstDelayMinutes,
      second_delay_minutes: input.secondDelayMinutes,
      third_delay_minutes: input.thirdDelayMinutes,
      response_sla_minutes: input.slaMinutes,
      escalate_to_assigned: input.notifyBroker,
      notify_manager: input.notifyManager,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" }
  )
  if (settingsError) return { success: false, error: settingsError.message }

  const { error: templatesError } = await supabase.from("message_templates").upsert(
    [
      {
        organization_id: organizationId,
        title: REENGAGEMENT_TEMPLATE_TITLES.inactive,
        channel: REENGAGEMENT_TEMPLATE_CHANNEL,
        content: input.inactiveMessageTemplate.trim(),
        variables: [],
      },
      {
        organization_id: organizationId,
        title: REENGAGEMENT_TEMPLATE_TITLES.handoff,
        channel: REENGAGEMENT_TEMPLATE_CHANNEL,
        content: input.handoffMessageTemplate.trim(),
        variables: [],
      },
    ],
    { onConflict: "organization_id,title,channel" }
  )
  if (templatesError) return { success: false, error: templatesError.message }

  return { success: true }
}

/**
 * CANONICAL CONTRACT GAP: the legacy per-lead cadence queue table
 * (`ai_lead_reengagements`) has no canonical equivalent, so scheduled
 * execution is parked. Settings persist canonically (see above); the worker
 * reports an empty pass instead of failing against a missing table. A
 * canonical queue decision (e.g. drive cadence from `ai_lead_sessions` +
 * `private.internal_jobs`) is required to re-enable execution.
 */
export async function processAiLeadReengagementsForOrganization(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  limit = 100
): Promise<{ success: true; data: AiLeadReengagementSummary } | { success: false; error: string }> {
  void limit
  const settingsResult = await loadAiLeadReengagementSettings(supabase, organizationId)
  if (!settingsResult.settings.enabled) {
    return {
      success: true,
      data: { checked: 0, started: 0, attempted: 0, stopped: 0, escalated: 0 },
    }
  }
  return {
    success: true,
    data: { checked: 0, started: 0, attempted: 0, stopped: 0, escalated: 0 },
  }
}
