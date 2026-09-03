import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database, Json } from "@/lib/supabase/database.types"

type ContactRow = Database["public"]["Tables"]["contacts"]["Row"]
// CANONICAL CONTRACT GAP: see operational-funnel.ts — contact-level deal
// tables have no canonical equivalent (opportunity-keyed instead).
type ContractRow = { contact_id: string; final_value: number | null; created_at: string; updated_at: string }
type ProposalRow = { contact_id: string; proposed_value: number | null; created_at: string; updated_at: string }
type ContactEventRow = Database["public"]["Tables"]["contact_events"]["Row"]

export type AttributionPeriod = "today" | "7d" | "30d"

export type LeadAttributionRow = {
  origin: string
  campaign: string | null
  closedCount: number
  closedValue: number
}

export type LeadAttributionOriginRow = {
  origin: string
  closedCount: number
  closedValue: number
}

export type LeadAttributionMetrics = {
  period: AttributionPeriod
  rows: LeadAttributionRow[]
  byOrigin: LeadAttributionOriginRow[]
  totals: {
    closedCount: number
    closedValue: number
  }
}

const WON_CONTACTS_PAGE_SIZE = 1000
const RELATED_CONTACT_IDS_CHUNK_SIZE = 500

function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

function periodSince(period: AttributionPeriod) {
  if (period === "today") return startOfToday()

  const now = new Date()
  const date = new Date(now)
  date.setDate(date.getDate() - (period === "7d" ? 7 : 30))
  return date.toISOString()
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizePayload(payload: Json | null | undefined): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {}
  return payload as Record<string, unknown>
}

function extractCampaign(payload: Json | null | undefined) {
  const data = normalizePayload(payload)

  return (
    normalizeText(data.campaign) ||
    normalizeText(data.utm_campaign) ||
    normalizeText(data.source_domain) ||
    normalizeText(data.external_id) ||
    null
  )
}

function getLatestByContactId<T extends { contact_id: string; updated_at?: string | null; created_at?: string | null }>(
  rows: T[]
) {
  const map = new Map<string, T>()

  for (const row of rows) {
    const current = map.get(row.contact_id)
    const candidateTs = row.updated_at || row.created_at || ""
    const currentTs = current?.updated_at || current?.created_at || ""

    if (!current || candidateTs > currentTs) {
      map.set(row.contact_id, row)
    }
  }

  return map
}

function getLatestLeadEventByContactId(
  rows: Array<Pick<ContactEventRow, "contact_id" | "source" | "payload" | "created_at">>
) {
  const map = new Map<string, Pick<ContactEventRow, "contact_id" | "source" | "payload" | "created_at">>()

  for (const row of rows) {
    const current = map.get(row.contact_id)
    const candidateTs = row.created_at || ""
    const currentTs = current?.created_at || ""

    if (!current || candidateTs > currentTs) {
      map.set(row.contact_id, row)
    }
  }

  return map
}

function roundCurrency(value: number) {
  return Number(value.toFixed(2))
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

async function fetchWonContacts(
  supabase: SupabaseClient,
  organizationId: string,
  since: string
) {
  const rows: Array<Pick<ContactRow, "id" | "status" | "updated_at">> = []
  let from = 0

  while (true) {
    const to = from + WON_CONTACTS_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from("contacts")
      .select("id, status, updated_at")
      .eq("organization_id", organizationId)
      .eq("status", "won")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .range(from, to)

    if (error) {
      throw error
    }

    const page = (data ?? []) as Array<Pick<ContactRow, "id" | "status" | "updated_at">>
    if (page.length === 0) {
      break
    }

    rows.push(...page)

    if (page.length < WON_CONTACTS_PAGE_SIZE) {
      break
    }

    from += WON_CONTACTS_PAGE_SIZE
  }

  return rows
}

export async function loadLeadAttributionMetrics(
  supabase: SupabaseClient,
  organizationId: string | null | undefined,
  period: AttributionPeriod
): Promise<LeadAttributionMetrics> {
  if (!organizationId) {
    return {
      period,
      rows: [],
      byOrigin: [],
      totals: { closedCount: 0, closedValue: 0 },
    }
  }

  const since = periodSince(period)

  // `updated_at` is the best available proxy for the `won` transition in the current schema.
  const wonContacts = await fetchWonContacts(supabase, organizationId, since)
  if (wonContacts.length === 0) {
    return {
      period,
      rows: [],
      byOrigin: [],
      totals: { closedCount: 0, closedValue: 0 },
    }
  }

  const contactIds = wonContacts.map((contact) => contact.id)
  const contactIdChunks = chunkArray(contactIds, RELATED_CONTACT_IDS_CHUNK_SIZE)
  const contractRows: Array<
    Pick<ContractRow, "contact_id" | "final_value" | "created_at" | "updated_at">
  > = []
  const proposalRows: Array<
    Pick<ProposalRow, "contact_id" | "proposed_value" | "created_at" | "updated_at">
  > = []
  const leadEventRows: Array<Pick<ContactEventRow, "contact_id" | "source" | "payload" | "created_at">> = []

  for (const ids of contactIdChunks) {
    const [contractsResult, proposalsResult, eventsResult] = await Promise.all([
      supabase
        .from("deal_contracts")
        .select("contact_id, final_value, created_at, updated_at")
        .eq("organization_id", organizationId)
        .in("contact_id", ids)
        .order("updated_at", { ascending: false }),
      supabase
        .from("deal_proposals")
        .select("contact_id, proposed_value, status, created_at, updated_at")
        .eq("organization_id", organizationId)
        .eq("status", "accepted")
        .in("contact_id", ids)
        .order("updated_at", { ascending: false }),
      supabase
        .from("contact_events")
        .select("contact_id, source, payload, created_at")
        .eq("organization_id", organizationId)
        .eq("event_type", "lead_received")
        .in("contact_id", ids)
        .order("created_at", { ascending: false }),
    ])

    if (contractsResult.error) throw contractsResult.error
    if (proposalsResult.error) throw proposalsResult.error
    if (eventsResult.error) throw eventsResult.error

    contractRows.push(
      ...((contractsResult.data ?? []) as Array<
        Pick<ContractRow, "contact_id" | "final_value" | "created_at" | "updated_at">
      >)
    )
    proposalRows.push(
      ...((proposalsResult.data ?? []) as Array<
        Pick<ProposalRow, "contact_id" | "proposed_value" | "created_at" | "updated_at">
      >)
    )
    leadEventRows.push(
      ...((eventsResult.data ?? []) as Array<
        Pick<ContactEventRow, "contact_id" | "source" | "payload" | "created_at">
      >)
    )
  }

  const latestContracts = getLatestByContactId(
    contractRows.map(
      (row) => ({
        ...row,
        updated_at: row.updated_at,
        created_at: row.created_at,
      })
    )
  )

  const latestAcceptedProposals = getLatestByContactId(
    proposalRows.map((row) => ({
      ...row,
      updated_at: row.updated_at,
      created_at: row.created_at,
    }))
  )

  const latestLeadEvents = getLatestLeadEventByContactId(
    leadEventRows
  )

  const grouped = new Map<string, LeadAttributionRow>()
  const groupedByOrigin = new Map<string, LeadAttributionOriginRow>()
  let totalCount = 0
  let totalValue = 0

  for (const contact of wonContacts) {
    const contract = latestContracts.get(contact.id)
    const proposal = latestAcceptedProposals.get(contact.id)
    const event = latestLeadEvents.get(contact.id)

    const origin = normalizeText(event?.source) || "unknown"
    const campaign = extractCampaign(event?.payload)
    const closedValue = roundCurrency(
      Number(contract?.final_value ?? proposal?.proposed_value ?? 0)
    )

    const key = `${origin}::${campaign || ""}`
    const current = grouped.get(key) ?? {
      origin,
      campaign,
      closedCount: 0,
      closedValue: 0,
    }

    current.closedCount += 1
    current.closedValue = roundCurrency(current.closedValue + closedValue)
    grouped.set(key, current)

    const currentOrigin = groupedByOrigin.get(origin) ?? {
      origin,
      closedCount: 0,
      closedValue: 0,
    }
    currentOrigin.closedCount += 1
    currentOrigin.closedValue = roundCurrency(currentOrigin.closedValue + closedValue)
    groupedByOrigin.set(origin, currentOrigin)

    totalCount += 1
    totalValue = roundCurrency(totalValue + closedValue)
  }

  const rows = Array.from(grouped.values()).sort((a, b) => {
    if (b.closedValue !== a.closedValue) return b.closedValue - a.closedValue
    if (b.closedCount !== a.closedCount) return b.closedCount - a.closedCount
    return a.origin.localeCompare(b.origin)
  })

  const byOrigin = Array.from(groupedByOrigin.values()).sort((a, b) => {
    if (b.closedValue !== a.closedValue) return b.closedValue - a.closedValue
    if (b.closedCount !== a.closedCount) return b.closedCount - a.closedCount
    return a.origin.localeCompare(b.origin)
  })

  return {
    period,
    rows,
    byOrigin,
    totals: {
      closedCount: totalCount,
      closedValue: totalValue,
    },
  }
}
