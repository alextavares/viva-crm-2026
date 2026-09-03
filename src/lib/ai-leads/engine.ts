import type { SupabaseClient } from "@supabase/supabase-js"


type ContactRow = Database["public"]["Tables"]["contacts"]["Row"]

/**
 * Minimal contact shape the AI engine reads. All fields exist canonically;
 * legacy columns (`handoff_to_profile_id`, `deal_stage`) are intentionally
 * absent.
 */
export type EngineContact = {
  id: string
  organization_id: string
  name: string
  phone: string | null
  type: string | null
  status: string | null
  assigned_to: string | null
  city: string | null
  interest_type: string | null
  interest_neighborhoods: string[] | null
  interest_price_max: number | null
}
type SessionRow = Database["public"]["Tables"]["ai_lead_sessions"]["Row"]
type QualificationRow = Database["public"]["Tables"]["ai_lead_qualifications"]["Row"]

type SendAiMessageResult =
  | { success: true; mode: "sandbox" | "live"; messageId: string; providerMessageId: string | null }
  | { success: false; error: string }

const metaFetch = fetchWithTimeout(15000)

function nowIso() {
  return new Date().toISOString()
}

function defaultAiOpeningMessage(contactName: string | null | undefined) {
  const name = normalizeAiText(contactName, 80)
  return name
    ? `Olá ${name}! Sou a assistente virtual da imobiliária. Para te ajudar melhor, você está buscando comprar ou alugar um imóvel?`
    : "Olá! Sou a assistente virtual da imobiliária. Para te ajudar melhor, você está buscando comprar ou alugar um imóvel?"
}

export function isAiEligibleContact(contact: {
  phone: string | null
  status: string | null
  type: string | null
}) {
  if (contact.type !== "lead") return false
  if (!waMeNumberFromPhone(contact.phone || "")) return false
  if (contact.status === "lost" || contact.status === "won") return false
  return true
}

export async function getLatestAiSession(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  contactId: string
) {
  const { data, error } = await supabase
    .from("ai_lead_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as SessionRow | null
}

export async function getActiveAiSession(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  contactId: string
) {
  const { data, error } = await supabase
    .from("ai_lead_sessions")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .in("status", ["active", "qualified", "handoff_requested", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as SessionRow | null
}

export async function getAiQualification(
  supabase: SupabaseClient<Database>,
  sessionId: string
) {
  const { data, error } = await supabase
    .from("ai_lead_qualifications")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle()

  if (error) throw error
  return data as QualificationRow | null
}

async function registerAiEvent(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  contactId: string,
  action: string,
  text: string,
  extraPayload: Record<string, unknown> = {}
) {
  await supabase.from("contact_events").insert({
    organization_id: organizationId,
    contact_id: contactId,
    event_type: "note_added",
    source: "ai_leads",
    payload: {
      action,
      text,
      ...extraPayload,
    },
  })
}

async function syncContactAiSnapshot(
  supabase: SupabaseClient<Database>,
  contactId: string,
  data: Partial<Database["public"]["Tables"]["contacts"]["Update"]>
) {
  await supabase.from("contacts").update({ ...data, updated_at: nowIso() }).eq("id", contactId)
}

export async function sendAiWhatsAppMessage(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  contact: Pick<ContactRow, "id" | "name" | "phone">,
  sessionId: string,
  content: string
): Promise<SendAiMessageResult> {
  const to = waMeNumberFromPhone(contact.phone || "")
  if (!to) {
    return { success: false, error: "Contato sem telefone válido para WhatsApp." }
  }

  const { data: channelData, error: channelError } = await supabase
    .from("whatsapp_channel_settings")
    .select("operation_mode, phone_number_id, status")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (channelError) {
    return { success: false, error: channelError.message }
  }

  if (!channelData) {
    return { success: false, error: "Canal oficial do WhatsApp não configurado para a organização." }
  }

  const isSandbox = channelData.operation_mode === "sandbox"
  const phoneNumberId = normalizeAiText(channelData.phone_number_id, 120)
  // CANONICAL CONTRACT GAP: production send credentials live in
  // private.integration_credentials (purpose whatsapp_access) with no
  // PostgREST read path, so live sends cannot authenticate.
  if (!isSandbox) {
    return {
      success: false,
      error: "Envio oficial indisponível: credencial do WhatsApp sem caminho de leitura no contrato canônico.",
    }
  }

  if (channelData.status !== "connected" || !phoneNumberId) {
    return { success: false, error: "Canal oficial indisponível para o disparo automático da IA." }
  }

  // Canonical policy gate: `whatsapp_addon_settings` carries the kill switch.
  // Per-message quota metering has no canonical read path (private usage
  // tables are not PostgREST-exposed), so metering is a contract gap.
  const { data: addonSettings } = await supabase
    .from("whatsapp_addon_settings")
    .select("enabled")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (addonSettings && !addonSettings.enabled) {
    const blockedMessage = "Envio oficial bloqueado por política comercial."

    await supabase.from("contact_events").insert({
      organization_id: organizationId,
      contact_id: contact.id,
      event_type: "whatsapp_policy_blocked",
      source: "ai_leads",
      payload: {
        reason: "blocked",
        message: blockedMessage,
      },
    })

    return { success: false, error: blockedMessage }
  }

  // Sandbox path only: production sends are refused above (no canonical
  // credential read path). The sandbox records the message locally.
  const providerMessageId: string | null = `sandbox-${Date.now()}`

  const insertedAt = nowIso()
  const { data: insertedMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      organization_id: organizationId,
      contact_id: contact.id,
      direction: "out",
      channel: isSandbox ? "whatsapp_official_sandbox" : "whatsapp_official",
      body: content,
      created_at: insertedAt,
    })
    .select("id")
    .single()

  if (insertError) {
    return { success: false, error: insertError.message }
  }

  await supabase.from("ai_lead_messages").insert({
    organization_id: organizationId,
    session_id: sessionId,
    direction: "outbound",
    author: "ai",
    channel: "whatsapp",
    content,
    payload_json: {
      message_id: insertedMessage.id,
      operation_mode: isSandbox ? "sandbox" : "live",
      provider_message_id: providerMessageId,
    },
    created_at: insertedAt,
  })

  await supabase.from("ai_lead_sessions").update({
    last_message_at: insertedAt,
    updated_at: insertedAt,
  }).eq("id", sessionId)

  await supabase.from("contact_events").insert({
    organization_id: organizationId,
      contact_id: contact.id,
      event_type: "note_added",
    source: "ai_leads",
    payload: {
      action: "ai_message_sent",
      message_id: insertedMessage.id,
      operation_mode: isSandbox ? "sandbox" : "live",
      provider_message_id: providerMessageId,
      text: isSandbox ? "IA enviou mensagem em sandbox." : "IA enviou mensagem no canal oficial.",
    },
    created_at: insertedAt,
  })

  return {
    success: true,
    mode: isSandbox ? "sandbox" : "live",
    messageId: insertedMessage.id,
    providerMessageId,
  }
}

export async function createAiLeadSession(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  contact: EngineContact,
  source: Database["public"]["Tables"]["ai_lead_sessions"]["Insert"]["source"] = "manual"
) {
  const existing = await getActiveAiSession(supabase, organizationId, contact.id)
  if (existing) {
    return { session: existing, created: false }
  }

  const insertedAt = nowIso()
  const { data: session, error: sessionError } = await supabase
    .from("ai_lead_sessions")
    .insert({
      organization_id: organizationId,
      contact_id: contact.id,
      source,
      status: "active",
      current_step: "intent",
      started_at: insertedAt,
      created_at: insertedAt,
      updated_at: insertedAt,
    })
    .select("*")
    .single()

  if (sessionError) throw sessionError

  const summary = buildAiSummary({
    property_type: contact.interest_type,
    city: contact.city,
    budget_max: contact.interest_price_max,
  })

  await supabase.from("ai_lead_qualifications").upsert({
    session_id: session.id,
    organization_id: organizationId,
    property_type: contact.interest_type,
    city: contact.city,
    budget_max: contact.interest_price_max,
    neighborhoods: contact.interest_neighborhoods ?? [],
    stage_score: computeAiStageScore({
      property_type: contact.interest_type,
      city: contact.city,
      neighborhoods: contact.interest_neighborhoods,
      budget_max: contact.interest_price_max,
    }),
    summary,
    updated_at: insertedAt,
  }, { onConflict: "organization_id,session_id" })

  await syncContactAiSnapshot(supabase, contact.id, {
    ai_status: "active",
    ai_score: computeAiStageScore({
      property_type: contact.interest_type,
      city: contact.city,
      neighborhoods: contact.interest_neighborhoods,
      budget_max: contact.interest_price_max,
    }),
    ai_last_summary: summary,
  })

  await registerAiEvent(
    supabase,
    organizationId,
    contact.id,
    "ai_session_started",
    "Pré-atendimento IA iniciado para este lead.",
    { session_id: session.id }
  )

  const openingMessage = defaultAiOpeningMessage(contact.name)
  const sendResult = await sendAiWhatsAppMessage(supabase, organizationId, contact, session.id, openingMessage)
  if (!sendResult.success) {
    await registerAiEvent(
      supabase,
      organizationId,
      contact.id,
      "ai_session_start_failed",
      `IA não conseguiu disparar a primeira mensagem: ${sendResult.error}`,
      { session_id: session.id }
    )
  }

  return { session, created: true, sendResult }
}

export async function processAiInboundReply(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  session: SessionRow,
  contact: EngineContact,
  message: string
) {
  const content = normalizeAiText(message, 4096)
  if (!content) {
    return { success: false as const, error: "Mensagem vazia para processamento da IA." }
  }

  const insertedAt = nowIso()
  await Promise.all([
    supabase.from("ai_lead_messages").insert({
      organization_id: organizationId,
      session_id: session.id,
      direction: "inbound",
      author: "contact",
      channel: "whatsapp",
      content,
      created_at: insertedAt,
    }),
    supabase.from("messages").insert({
      organization_id: organizationId,
      contact_id: contact.id,
      direction: "in",
      channel: "whatsapp_official",
      body: content,
      created_at: insertedAt,
    }),
  ])


  const currentQualification = (await getAiQualification(supabase, session.id)) ?? {
    session_id: session.id,
    organization_id: organizationId,
    intent: null,
    transaction_type: null,
    property_type: null,
    city: null,
    neighborhoods: null,
    budget_min: null,
    budget_max: null,
    timeline: null,
    stage_score: 0,
    summary: null,
    updated_at: insertedAt,
  }

  const applied = applyQualificationStep(session.current_step, content, currentQualification)
  const stageScore = computeAiStageScore(applied)
  const summary = buildAiSummary(applied)
  const qualified = isCommerciallyQualified(applied)
  const triggerHandoff = qualified || hasStrongCommercialTrigger(content)

  await supabase.from("ai_lead_qualifications").upsert({
    session_id: session.id,
    organization_id: organizationId,
    intent: applied.intent ?? null,
    transaction_type: applied.transaction_type ?? null,
    property_type: applied.property_type ?? null,
    city: applied.city ?? null,
    neighborhoods: applied.neighborhoods ?? [],
    budget_min: applied.budget_min ?? null,
    budget_max: applied.budget_max ?? null,
    timeline: applied.timeline ?? null,
    stage_score: stageScore,
    summary,
    updated_at: insertedAt,
  }, { onConflict: "organization_id,session_id" })

  await syncContactAiSnapshot(supabase, contact.id, {
    ai_status: triggerHandoff ? "qualified" : "active",
    ai_score: stageScore,
    ai_last_summary: summary,
    qualified_by_ai_at: triggerHandoff ? insertedAt : null,
  })

  if (triggerHandoff) {
    await supabase.from("ai_lead_sessions").update({
      status: "qualified",
      qualified_at: insertedAt,
      updated_at: insertedAt,
    }).eq("id", session.id)

    await registerAiEvent(
      supabase,
      organizationId,
      contact.id,
      "ai_session_qualified",
      "IA concluiu a qualificação mínima e deixou o lead pronto para handoff.",
      { session_id: session.id, summary, stage_score: stageScore }
    )

    return { success: true as const, qualified: true, summary }
  }

  const nextQuestion = nextAiQuestion(applied)
  await supabase.from("ai_lead_sessions").update({
    current_step: nextQuestion.nextStep,
    updated_at: insertedAt,
  }).eq("id", session.id)

  const sendResult = await sendAiWhatsAppMessage(supabase, organizationId, contact, session.id, nextQuestion.message)
  if (!sendResult.success) {
    return { success: false as const, error: sendResult.error }
  }

  return { success: true as const, qualified: false, summary }
}

export async function requestAiHandoff(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  session: SessionRow,
  contact: ContactRow
) {
  const handoffTarget = await resolveAiHandoffBroker(supabase, organizationId, contact.id, contact.assigned_to)
  if (!handoffTarget.success) {
    return handoffTarget
  }

  const insertedAt = nowIso()
  const qualification = await getAiQualification(supabase, session.id)
  const summary = buildAiSummary(qualification ?? {}) ?? "Resumo de qualificação ainda em construção."

  await supabase.from("ai_lead_sessions").update({
    status: "qualified",
    assigned_to: handoffTarget.brokerId,
    handoff_requested_at: insertedAt,
    updated_at: insertedAt,
  }).eq("id", session.id)

  await syncContactAiSnapshot(supabase, contact.id, {
    ai_status: "handoff_requested",
    ai_score: qualification?.stage_score ?? null,
    ai_last_summary: summary,
    qualified_by_ai_at: qualification ? insertedAt : null,
    assigned_to: handoffTarget.brokerId,
    handoff_at: insertedAt,
  })

  await registerAiEvent(
    supabase,
    organizationId,
    contact.id,
    "ai_handoff_requested",
    "IA solicitou handoff para corretor.",
    {
      session_id: session.id,
      handoff_mode: handoffTarget.mode,
      broker_id: handoffTarget.brokerId,
      summary,
    }
  )

  return {
    success: true as const,
    brokerId: handoffTarget.brokerId,
    mode: handoffTarget.mode,
    summary,
  }
}

export async function completeAiTakeover(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  session: SessionRow,
  contact: EngineContact,
  actorProfileId: string
) {
  const insertedAt = nowIso()

  await supabase.from("ai_lead_sessions").update({
    status: "handed_off",
    assigned_to: session.assigned_to ?? actorProfileId,
    handoff_completed_at: insertedAt,
    updated_at: insertedAt,
  }).eq("id", session.id)

  await syncContactAiSnapshot(supabase, contact.id, {
    ai_status: "handoff_completed",
    assigned_to: session.assigned_to ?? actorProfileId,
    handoff_at: insertedAt,
  })

  await registerAiEvent(
    supabase,
    organizationId,
    contact.id,
    "ai_handoff_completed",
    "Corretor assumiu a conversa após a qualificação da IA.",
    {
      session_id: session.id,
      broker_id: session.assigned_to ?? actorProfileId,
    }
  )
}

export async function setAiSessionPaused(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  session: SessionRow,
  contactId: string,
  paused: boolean
) {
  const insertedAt = nowIso()
  await supabase.from("ai_lead_sessions").update({
    status: paused ? "paused" : "active",
    paused_at: paused ? insertedAt : null,
    updated_at: insertedAt,
  }).eq("id", session.id)

  await syncContactAiSnapshot(supabase, contactId, {
    ai_status: paused ? "paused" : "active",
  })

  await registerAiEvent(
    supabase,
    organizationId,
    contactId,
    paused ? "ai_session_paused" : "ai_session_resumed",
    paused ? "Pré-atendimento IA pausado manualmente." : "Pré-atendimento IA retomado manualmente.",
    { session_id: session.id }
  )
}
