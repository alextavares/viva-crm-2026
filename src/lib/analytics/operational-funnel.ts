import type { SupabaseClient } from "@supabase/supabase-js"

import { isMissingAiSchemaErrorMessage } from "@/lib/ai-leads/schema-guards"
import type { Database } from "@/lib/supabase/database.types"

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"]
type ContactEventRow = Database["public"]["Tables"]["contact_events"]["Row"]
type AiLeadSessionRow = Database["public"]["Tables"]["ai_lead_sessions"]["Row"]
type AiLeadMessageRow = Database["public"]["Tables"]["ai_lead_messages"]["Row"]
type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"]
type ProposalRow = Database["public"]["Tables"]["deal_proposals"]["Row"]

export type FunnelPeriod = "today" | "7d" | "30d"

export type FunnelStageKey =
  | "lead_received"
  | "ai_responded"
  | "qualified"
  | "handoff_requested"
  | "handoff_completed"
  | "appointment_created"
  | "proposal_accepted"
  | "won"

export type FunnelStageRow = {
  key: FunnelStageKey
  label: string
  count: number
  conversionFromPrevious: number | null
  conversionFromStart: number | null
}

export type OperationalFunnelMetrics = {
  period: FunnelPeriod
  totalLeads: number
  stages: FunnelStageRow[]
}

function emptyOperationalFunnelMetrics(period: FunnelPeriod): OperationalFunnelMetrics {
  return {
    period,
    totalLeads: 0,
    stages: STAGE_ORDER.map((stage) => ({
      ...stage,
      count: 0,
      conversionFromPrevious: null,
      conversionFromStart: null,
    })),
  }
}

const LEAD_EVENTS_PAGE_SIZE = 1000
const CONTACT_CHUNK_SIZE = 500
const SESSION_CHUNK_SIZE = 500

const STAGE_ORDER: Array<{ key: FunnelStageKey; label: string }> = [
  { key: "lead_received", label: "Lead recebido" },
  { key: "ai_responded", label: "Respondido pela IA" },
  { key: "qualified", label: "Qualificado" },
  { key: "handoff_requested", label: "Handoff solicitado" },
  { key: "handoff_completed", label: "Handoff assumido" },
  { key: "appointment_created", label: "Visita" },
  { key: "proposal_accepted", label: "Proposta aceita" },
  { key: "won", label: "Fechado" },
]

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

function periodSince(period: FunnelPeriod) {
  if (period === "today") return startOfToday()

  const now = new Date()
  const date = new Date(now)
  date.setDate(date.getDate() - (period === "7d" ? 7 : 30))
  return date.toISOString()
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function roundPercent(value: number) {
  return Number(value.toFixed(1))
}

async function fetchLeadReceivedContactIds(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  since: string
) {
  const contactIds = new Set<string>()
  let from = 0

  while (true) {
    const to = from + LEAD_EVENTS_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from("contact_events")
      .select("contact_id, created_at")
      .eq("organization_id", organizationId)
      .eq("type", "lead_received")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .range(from, to)

    if (error) {
      throw error
    }

    const page = (data ?? []) as Array<Pick<ContactEventRow, "contact_id" | "created_at">>
    if (page.length === 0) {
      break
    }

    for (const row of page) {
      contactIds.add(row.contact_id)
    }

    if (page.length < LEAD_EVENTS_PAGE_SIZE) {
      break
    }

    from += LEAD_EVENTS_PAGE_SIZE
  }

  return Array.from(contactIds)
}

export async function loadOperationalFunnelMetrics(
  supabase: SupabaseClient<Database>,
  organizationId: string | null | undefined,
  period: FunnelPeriod
): Promise<OperationalFunnelMetrics> {
  if (!organizationId) {
    return emptyOperationalFunnelMetrics(period)
  }

  const since = periodSince(period)
  const contactIds = await fetchLeadReceivedContactIds(supabase, organizationId, since)

  if (contactIds.length === 0) {
    return emptyOperationalFunnelMetrics(period)
  }

  const contactChunks = chunkArray(contactIds, CONTACT_CHUNK_SIZE)
  const sessionRows: Array<
    Pick<
      AiLeadSessionRow,
      "id" | "contact_id" | "qualified_at" | "handoff_requested_at" | "handoff_completed_at"
    >
  > = []
  const appointmentRows: Array<Pick<AppointmentRow, "contact_id">> = []
  const acceptedProposalRows: Array<Pick<ProposalRow, "contact_id">> = []
  const contactRows: Array<Pick<ContactRow, "id" | "status">> = []

  for (const ids of contactChunks) {
    const [sessionsResult, appointmentsResult, proposalsResult, contactsResult] = await Promise.all([
      supabase
        .from("ai_lead_sessions")
        .select("id, contact_id, qualified_at, handoff_requested_at, handoff_completed_at")
        .eq("organization_id", organizationId)
        .in("contact_id", ids),
      supabase
        .from("appointments")
        .select("contact_id")
        .eq("organization_id", organizationId)
        .in("contact_id", ids),
      supabase
        .from("deal_proposals")
        .select("contact_id")
        .eq("organization_id", organizationId)
        .eq("status", "accepted")
        .in("contact_id", ids),
      supabase
        .from("contacts")
        .select("id, status")
        .eq("organization_id", organizationId)
        .in("id", ids),
    ])

    if (sessionsResult.error) {
      const message =
        `${sessionsResult.error.code ?? ""} ${sessionsResult.error.message ?? ""} ${sessionsResult.error.details ?? ""} ${sessionsResult.error.hint ?? ""}`.trim()
      if (isMissingAiSchemaErrorMessage(message)) {
        return emptyOperationalFunnelMetrics(period)
      }
      throw sessionsResult.error
    }
    if (appointmentsResult.error) throw appointmentsResult.error
    if (proposalsResult.error) throw proposalsResult.error
    if (contactsResult.error) throw contactsResult.error

    sessionRows.push(
      ...((sessionsResult.data ?? []) as Array<
        Pick<
          AiLeadSessionRow,
          "id" | "contact_id" | "qualified_at" | "handoff_requested_at" | "handoff_completed_at"
        >
      >)
    )
    appointmentRows.push(...((appointmentsResult.data ?? []) as Array<Pick<AppointmentRow, "contact_id">>))
    acceptedProposalRows.push(
      ...((proposalsResult.data ?? []) as Array<Pick<ProposalRow, "contact_id">>)
    )
    contactRows.push(...((contactsResult.data ?? []) as Array<Pick<ContactRow, "id" | "status">>))
  }

  const sessionIdToContactId = new Map<string, string>()
  const qualifiedContacts = new Set<string>()
  const handoffRequestedContacts = new Set<string>()
  const handoffCompletedContacts = new Set<string>()

  for (const session of sessionRows) {
    sessionIdToContactId.set(session.id, session.contact_id)
    if (session.qualified_at) qualifiedContacts.add(session.contact_id)
    if (session.handoff_requested_at) handoffRequestedContacts.add(session.contact_id)
    if (session.handoff_completed_at) handoffCompletedContacts.add(session.contact_id)
  }

  const respondedContacts = new Set<string>()
  const sessionIds = Array.from(sessionIdToContactId.keys())
  const sessionChunks = chunkArray(sessionIds, SESSION_CHUNK_SIZE)

  for (const ids of sessionChunks) {
    if (ids.length === 0) continue

    const { data, error } = await supabase
      .from("ai_lead_messages")
      .select("session_id, direction, author")
      .eq("organization_id", organizationId)
      .eq("direction", "outbound")
      .eq("author", "ai")
      .in("session_id", ids)

    if (error) {
      const message = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.trim()
      if (isMissingAiSchemaErrorMessage(message)) {
        return emptyOperationalFunnelMetrics(period)
      }
      throw error
    }

    for (const row of (data ?? []) as Array<Pick<AiLeadMessageRow, "session_id" | "direction" | "author">>) {
      const contactId = sessionIdToContactId.get(row.session_id)
      if (contactId) {
        respondedContacts.add(contactId)
      }
    }
  }

  const appointmentContacts = new Set<string>()
  for (const row of appointmentRows) {
    if (row.contact_id) {
      appointmentContacts.add(row.contact_id)
    }
  }

  const proposalAcceptedContacts = new Set<string>()
  for (const row of acceptedProposalRows) {
    if (row.contact_id) {
      proposalAcceptedContacts.add(row.contact_id)
    }
  }

  const wonContacts = new Set<string>()
  for (const row of contactRows) {
    if (row.status === "won") {
      wonContacts.add(row.id)
    }
  }

  const totalLeads = contactIds.length
  let previousCount: number | null = null
  const stages = STAGE_ORDER.map((stage) => {
    let count = 0

    switch (stage.key) {
      case "lead_received":
        count = totalLeads
        break
      case "ai_responded":
        count = respondedContacts.size
        break
      case "qualified":
        count = qualifiedContacts.size
        break
      case "handoff_requested":
        count = handoffRequestedContacts.size
        break
      case "handoff_completed":
        count = handoffCompletedContacts.size
        break
      case "appointment_created":
        count = appointmentContacts.size
        break
      case "proposal_accepted":
        count = proposalAcceptedContacts.size
        break
      case "won":
        count = wonContacts.size
        break
    }

    const conversionFromStart =
      totalLeads > 0 ? roundPercent((count / totalLeads) * 100) : null
    const conversionFromPrevious =
      previousCount && previousCount > 0 ? roundPercent((count / previousCount) * 100) : null

    previousCount = count

    return {
      key: stage.key,
      label: stage.label,
      count,
      conversionFromPrevious,
      conversionFromStart,
    }
  })

  return {
    period,
    totalLeads,
    stages,
  }
}
