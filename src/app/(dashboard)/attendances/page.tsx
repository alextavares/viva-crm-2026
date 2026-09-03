import Link from "next/link"

import { AttendanceFiltersInstant } from "@/components/attendances/attendance-filters-instant"
import { AttendanceList } from "@/components/attendances/attendance-list"
import { AttendanceSummaryStrip } from "@/components/attendances/attendance-summary-strip"
import { Button } from "@/components/ui/button"
import { getAttendanceMetrics } from "@/lib/attendances/attendance-metrics"
import { getAttendanceNextAction } from "@/lib/attendances/attendance-next-action"
import type { AttendanceQueueRow } from "@/lib/attendances/attendance-types"
import {
  buildLeadPropertyContext,
  collectLeadPropertyIds,
  extractLeadPropertyReference,
  type LeadPropertyReference,
  type PropertyLookupRecord,
} from "@/lib/contacts/lead-property-context"
import { loadLeadPropertyLookupById } from "@/lib/contacts/lead-property-lookup"
import { sortByLatestLeadActivity } from "@/lib/contacts/site-lead-order"
import { createClient } from "@/lib/supabase/server"

type SearchParams = {
  q?: string | string[]
  status?: string | string[]
  dealStage?: string | string[]
  priority?: string | string[]
  assignee?: string | string[]
  origin?: string | string[]
}

type ContactRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  type: string
  deal_stage?: string | null
  assigned_to?: string | null
  organization_id: string
  city?: string | null
  created_at: string | null
  updated_at?: string | null
}

type EventRow = {
  contact_id: string | null
  source: string | null
  payload: Record<string, unknown> | null
  created_at: string | null
}

type InteractionRow = {
  contact_id: string | null
  summary: string | null
  happened_at: string | null
}

type AppointmentRow = {
  id: string
  contact_id: string | null
  date: string
  status: string
}

function firstParam(value: string | string[] | undefined, fallback = "") {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

function buildParams(params: Record<string, string | null | undefined>) {
  const next = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (!value || value === "all") continue
    next.set(key, value)
  }
  const qs = next.toString()
  return qs ? `/attendances?${qs}` : "/attendances"
}

export default async function AttendancesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const params = await searchParams
  const q = firstParam(params.q).trim()
  const statusFilter = firstParam(params.status, "all")
  const dealStageFilter = firstParam(params.dealStage, "all")
  const priorityFilter = firstParam(params.priority, "all")
  const assigneeFilter = firstParam(params.assignee, "all")
  const originFilter = firstParam(params.origin, "all")

  const { data: profile } = user
    ? await supabase.from("profiles").select("id, role, organization_id").eq("id", user.id).single()
    : { data: null }

  const isBroker = profile?.role === "broker"

  let leadSettings = { sla_minutes: 15, enabled: true }
  const { data: leadSettingsData } = await supabase
    .from("lead_distribution_settings")
    .select("sla_minutes, enabled")
    .maybeSingle()

  if (leadSettingsData) {
    leadSettings = {
      sla_minutes: leadSettingsData.sla_minutes ?? 15,
      enabled: leadSettingsData.enabled ?? true,
    }
  }

  let contactsQuery = supabase
    .from("contacts")
    .select("id,name,email,phone,status,type,deal_stage,assigned_to,organization_id,city,created_at,updated_at")
    .eq("type", "lead")
    .in("status", ["new", "contacted", "qualified"])
    .order("created_at", { ascending: false })
    .limit(200)

  if (isBroker && user?.id) {
    contactsQuery = contactsQuery.eq("assigned_to", user.id)
  }

  if (q) {
    const safeQ = q.replace(/[,%]/g, " ").trim()
    if (safeQ) {
      contactsQuery = contactsQuery.or(`name.ilike.%${safeQ}%,email.ilike.%${safeQ}%,phone.ilike.%${safeQ}%`)
    }
  }

  if (statusFilter !== "all") {
    contactsQuery = contactsQuery.eq("status", statusFilter)
  }

  if (dealStageFilter !== "all") {
    contactsQuery = contactsQuery.eq("deal_stage", dealStageFilter)
  }

  if (assigneeFilter !== "all" && !isBroker) {
    contactsQuery = contactsQuery.eq("assigned_to", assigneeFilter)
  }

  const { data: contacts, error: contactsError } = await contactsQuery

  if (contactsError) {
    throw new Error(`Nao foi possivel carregar atendimentos: ${contactsError.message}`)
  }

  const contactRows = (contacts || []) as ContactRow[]
  const contactIds = contactRows.map((contact) => contact.id)
  const siteMetaByContactId = new Map<string, { source: string | null; domain: string | null; lastEventAt: string | null }>()
  const leadPropertyReferenceByContactId = new Map<string, LeadPropertyReference>()
  const latestInteractionByContactId = new Map<string, InteractionRow>()
  const nextAppointmentByContactId = new Map<string, AppointmentRow>()

  if (contactIds.length > 0) {
    const [eventsResult, interactionsResult, appointmentsResult] = await Promise.all([
      supabase
        .from("contact_events")
        .select("contact_id,source,payload,created_at")
        .eq("type", "lead_received")
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false })
        .limit(Math.max(contactIds.length * 4, 50)),
      supabase
        .from("contact_interactions")
        .select("contact_id,summary,happened_at")
        .in("contact_id", contactIds)
        .order("happened_at", { ascending: false })
        .limit(Math.max(contactIds.length * 4, 50)),
      supabase
        .from("appointments")
        .select("id,contact_id,date,status")
        .in("contact_id", contactIds)
        .eq("status", "scheduled")
        .gte("date", new Date().toISOString())
        .order("date", { ascending: true })
        .limit(Math.max(contactIds.length * 2, 50)),
    ])

    for (const event of ((eventsResult.data || []) as EventRow[])) {
      if (!event.contact_id) continue
      const payload = event.payload || {}
      const sourceDomain =
        (typeof payload.source_domain === "string" && payload.source_domain) ||
        (typeof payload.site_slug === "string" && payload.site_slug) ||
        null

      if (!siteMetaByContactId.has(event.contact_id)) {
        siteMetaByContactId.set(event.contact_id, {
          source: event.source,
          domain: sourceDomain,
          lastEventAt: event.created_at,
        })
      }

      if (!leadPropertyReferenceByContactId.has(event.contact_id)) {
        const reference = extractLeadPropertyReference(payload)
        if (reference) leadPropertyReferenceByContactId.set(event.contact_id, reference)
      }
    }

    for (const interaction of ((interactionsResult.data || []) as InteractionRow[])) {
      if (interaction.contact_id && !latestInteractionByContactId.has(interaction.contact_id)) {
        latestInteractionByContactId.set(interaction.contact_id, interaction)
      }
    }

    for (const appointment of ((appointmentsResult.data || []) as AppointmentRow[])) {
      if (appointment.contact_id && !nextAppointmentByContactId.has(appointment.contact_id)) {
        nextAppointmentByContactId.set(appointment.contact_id, appointment)
      }
    }
  }

  const leadPropertyIds = collectLeadPropertyIds(leadPropertyReferenceByContactId.values())
  const propertyLookupById: Map<string, PropertyLookupRecord> =
    leadPropertyIds.length > 0
      ? await loadLeadPropertyLookupById(supabase, leadPropertyIds, profile?.organization_id)
      : new Map()

  const assignedProfileIds = Array.from(
    new Set(contactRows.map((contact) => contact.assigned_to).filter(Boolean))
  ) as string[]
  const assignedProfileNameById = new Map<string, string>()

  if (assignedProfileIds.length > 0) {
    const { data: assignedProfiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", assignedProfileIds)

    for (const assignedProfile of assignedProfiles || []) {
      if (assignedProfile.full_name) assignedProfileNameById.set(assignedProfile.id, assignedProfile.full_name)
    }
  }

  let rows: AttendanceQueueRow[] = sortByLatestLeadActivity(
    contactRows.map((contact) => {
      const interaction = latestInteractionByContactId.get(contact.id)
      const appointment = nextAppointmentByContactId.get(contact.id)
      const siteMeta = siteMetaByContactId.get(contact.id) ?? null
      const leadPropertyContext = buildLeadPropertyContext(
        leadPropertyReferenceByContactId.get(contact.id),
        propertyLookupById
      )
      const nextAction = getAttendanceNextAction({
        status: contact.status,
        dealStage: contact.deal_stage ?? "lead",
        latestLeadAt: siteMeta?.lastEventAt ?? contact.created_at,
        latestInteractionAt: interaction?.happened_at ?? null,
        nextAppointmentAt: appointment?.date ?? null,
        hasPhone: Boolean(contact.phone),
        slaMinutes: leadSettings.sla_minutes,
      })

      return {
        ...contact,
        siteMeta,
        latestLeadAt: siteMeta?.lastEventAt ?? contact.created_at,
        latestInteractionAt: interaction?.happened_at ?? null,
        latestInteractionSummary: interaction?.summary ?? null,
        nextAppointmentAt: appointment?.date ?? null,
        nextAppointmentId: appointment?.id ?? null,
        assignedProfileName: contact.assigned_to ? assignedProfileNameById.get(contact.assigned_to) ?? null : null,
        leadPropertyContext: leadPropertyContext ?? null,
        nextAction,
      }
    })
  )

  if (priorityFilter !== "all") {
    rows = rows.filter((row) => row.nextAction.priority === priorityFilter)
  }

  if (originFilter !== "all") {
    rows = rows.filter((row) => row.siteMeta?.source === originFilter)
  }

  const metrics = getAttendanceMetrics(rows)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">Atendimentos</h1>
          <p className="text-muted-foreground">Fila operacional para decidir quem precisa de ação agora.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/contacts/site">Ver recorte de leads do site</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant={priorityFilter === "all" ? "secondary" : "outline"}>
          <Link href={buildParams({ q, status: statusFilter, dealStage: dealStageFilter, assignee: assigneeFilter, origin: originFilter })}>
            Todos
          </Link>
        </Button>
        <Button asChild size="sm" variant={priorityFilter === "critical" ? "secondary" : "outline"}>
          <Link
            href={buildParams({
              q,
              status: statusFilter,
              dealStage: dealStageFilter,
              assignee: assigneeFilter,
              origin: originFilter,
              priority: "critical",
            })}
          >
            SLA atrasado
          </Link>
        </Button>
        <Button asChild size="sm" variant={statusFilter === "new" ? "secondary" : "outline"}>
          <Link href={buildParams({ q, status: "new", dealStage: dealStageFilter, assignee: assigneeFilter, origin: originFilter, priority: priorityFilter })}>
            Novos
          </Link>
        </Button>
        <Button asChild size="sm" variant={statusFilter === "contacted" ? "secondary" : "outline"}>
          <Link
            href={buildParams({
              q,
              status: "contacted",
              dealStage: dealStageFilter,
              assignee: assigneeFilter,
              origin: originFilter,
              priority: priorityFilter,
            })}
          >
            Em atendimento
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="order-1 space-y-4">
          <AttendanceSummaryStrip metrics={metrics} />
          <AttendanceList rows={rows} />
        </div>

        <div className="order-2">
          <AttendanceFiltersInstant
            initialValues={{
              q,
              status: statusFilter,
              dealStage: dealStageFilter,
              priority: priorityFilter,
              assignee: assigneeFilter,
              origin: originFilter,
            }}
          />
        </div>
      </div>
    </div>
  )
}
