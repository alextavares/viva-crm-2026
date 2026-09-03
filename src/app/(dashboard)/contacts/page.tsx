import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ContactsFiltersInstant } from "@/components/contacts/contacts-filters-instant"
import {
  ContactsGrid,
  type EnrichedContactRow,
  type LeadDistributionSettings as LeadDistributionSettingsSnapshot,
} from "@/components/contacts/contacts-grid"
import { ContactsList } from "@/components/contacts/contacts-list"
import { LeadsKanban } from "@/components/leads/leads-kanban"
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
import { DEAL_STAGE_LABELS, DEAL_STAGES, type DealStage } from "@/lib/types"
import { Kanban, LayoutGrid, Plus, Rows3, User } from "lucide-react"

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
  created_at: string | null
  updated_at?: string | null
}

type ContactEventRow = {
  contact_id: string | null
  source: string | null
  payload: Record<string, unknown> | null
  created_at: string | null
}

type SiteMeta = {
  source: string | null
  domain: string | null
  lastEventAt: string | null
}

function getContactStatusLabel(status: string) {
  switch (status) {
    case "new":
      return "Novo"
    case "contacted":
      return "Em atendimento"
    case "qualified":
      return "Qualificado"
    case "lost":
      return "Perdido"
    case "won":
      return "Ganho"
    default:
      return status
  }
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const resolvedSearchParams = await searchParams

  const page = Number(resolvedSearchParams?.page) || 1
  const pageSize = Number(resolvedSearchParams?.pageSize) || 12
  const view = (resolvedSearchParams?.view as string) || "list"
  const q = typeof resolvedSearchParams?.q === "string" ? resolvedSearchParams.q.trim() : ""
  const statusFilter = typeof resolvedSearchParams?.status === "string" ? resolvedSearchParams.status : "all"
  const dealStageFilter = typeof resolvedSearchParams?.dealStage === "string" ? resolvedSearchParams.dealStage : "all"
  const originFilter = typeof resolvedSearchParams?.origin === "string" ? resolvedSearchParams.origin : "all"
  const scope = typeof resolvedSearchParams?.scope === "string" ? resolvedSearchParams.scope : "all"
  const domainFilterRaw = typeof resolvedSearchParams?.domain === "string" ? resolvedSearchParams.domain : ""
  const domainStateFilterRaw = typeof resolvedSearchParams?.domainState === "string" ? resolvedSearchParams.domainState : "all"
  const domainStateFilter =
    domainStateFilterRaw === "known" || domainStateFilterRaw === "unknown" ? domainStateFilterRaw : "all"
  const withPhoneFilter = typeof resolvedSearchParams?.withPhone === "string" ? resolvedSearchParams.withPhone : "all"
  const domainFilter = domainFilterRaw.trim().toLowerCase()
  const baseRoute = scope === "site" ? "/contacts/site" : "/contacts"

  const hasFilters = q !== "" || statusFilter !== "all" || dealStageFilter !== "all" || originFilter !== "all" || domainFilterRaw !== "" || domainStateFilter !== "all" || withPhoneFilter !== "all"

  const start = (page - 1) * pageSize
  const end = start + pageSize - 1

  const shouldFilterBySiteEvent = originFilter === "site" || domainFilter.length > 0
  const shouldSortSiteLeadsByLatestEvent = shouldFilterBySiteEvent && (scope === "site" || originFilter === "site")
  const siteMetaByContactId = new Map<string, SiteMeta>()
  const latestLeadEventByContactId = new Map<string, string>()
  const leadPropertyReferenceByContactId = new Map<string, LeadPropertyReference>()
  let siteContactIds: string[] | null = null

  const rememberLeadPropertyReference = (
    contactId: string,
    payload: Record<string, unknown> | null
  ) => {
    if (leadPropertyReferenceByContactId.has(contactId)) return
    const reference = extractLeadPropertyReference(payload)
    if (reference) {
      leadPropertyReferenceByContactId.set(contactId, reference)
    }
  }

  let leadDistributionSettings: LeadDistributionSettingsSnapshot = {
    sla_minutes: 15,
    enabled: true,
  }

  const { data: leadSettings, error: leadSettingsError } = await supabase
    .from("lead_distribution_settings")
    .select("sla_minutes, enabled")
    .maybeSingle()

  if (leadSettingsError && leadSettingsError.code !== "42P01") {
    console.error("Error fetching lead_distribution_settings:", {
      message: leadSettingsError.message,
      details: leadSettingsError.details,
      hint: leadSettingsError.hint,
      code: leadSettingsError.code,
    })
  } else if (leadSettings) {
    leadDistributionSettings = {
      sla_minutes: leadSettings.sla_minutes ?? 15,
      enabled: leadSettings.enabled ?? true,
    }
  }

  if (shouldFilterBySiteEvent) {
    let eventsQuery = supabase
      .from("contact_events")
      .select("contact_id,source,payload,created_at")
      .eq("type", "lead_received")
      .order("created_at", { ascending: false })
      .limit(5000)

    if (originFilter === "site") {
      eventsQuery = eventsQuery.eq("source", "site")
    }

    const { data: eventsData, error: eventsError } = await eventsQuery
    if (eventsError) {
      console.error("Error fetching site contact_events:", {
        message: (eventsError as { message?: string }).message,
        details: (eventsError as { details?: string }).details,
        hint: (eventsError as { hint?: string }).hint,
        code: (eventsError as { code?: string }).code,
      })
    } else {
      for (const event of (eventsData as ContactEventRow[] | null) || []) {
        const contactId = event.contact_id
        if (!contactId) continue

        const payload = event.payload || {}
        const sourceDomain =
          (typeof payload.source_domain === "string" && payload.source_domain) ||
          (typeof payload.site_slug === "string" && payload.site_slug) ||
          null
        const normalizedDomain = sourceDomain ? sourceDomain.toLowerCase() : null
        const domainMatches = !domainFilter || (normalizedDomain ? normalizedDomain.includes(domainFilter) : false)
        const domainStateMatches =
          domainStateFilter === "all" ||
          (domainStateFilter === "known" && Boolean(normalizedDomain)) ||
          (domainStateFilter === "unknown" && !normalizedDomain)
        if (!domainMatches || !domainStateMatches) continue

        if (!siteMetaByContactId.has(contactId)) {
          siteMetaByContactId.set(contactId, {
            source: event.source,
            domain: sourceDomain,
            lastEventAt: event.created_at,
          })
        }

        rememberLeadPropertyReference(contactId, payload)
      }
      siteContactIds = [...siteMetaByContactId.keys()]
    }
  }

  let contacts: ContactRow[] | null = null
  let count = 0
  let error: { message?: string; details?: string; hint?: string; code?: string } | null = null

  if (shouldFilterBySiteEvent && siteContactIds && siteContactIds.length === 0) {
    contacts = []
    count = 0
  } else {
    let query = supabase.from("contacts").select("*", { count: "exact" }).order("created_at", { ascending: false })

    if (q) {
      const safeQ = q.replace(/[,%]/g, " ").trim()
      if (safeQ) {
        query = query.or(`name.ilike.%${safeQ}%,email.ilike.%${safeQ}%,phone.ilike.%${safeQ}%`)
      }
    }

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter)
    }

    if (dealStageFilter !== "all") {
      query = query.eq("deal_stage", dealStageFilter)
    }

    if (withPhoneFilter === "yes") {
      query = query.not("phone", "is", null).neq("phone", "")
    }

    if (shouldFilterBySiteEvent && siteContactIds) {
      query = query.in("id", siteContactIds)
    }

    if (shouldSortSiteLeadsByLatestEvent) {
      query = query.range(0, 4999)
    } else if (view === "board") {
      query = query.range(0, 999)
    } else {
      query = query.range(start, end)
    }

    const queryResult = await query
    contacts = (queryResult.data as ContactRow[] | null) || []
    count = queryResult.count || 0
    error = queryResult.error as { message?: string; details?: string; hint?: string; code?: string } | null
  }

  if (contacts && contacts.length > 0) {
    const contactIds = contacts.map((c) => c.id)
    const { data: latestLeadEvents, error: latestLeadEventsError } = await supabase
      .from("contact_events")
      .select("contact_id,source,payload,created_at")
      .eq("type", "lead_received")
      .in("contact_id", contactIds)
      .order("created_at", { ascending: false })
      .limit(Math.max(contactIds.length * 4, 50))

    if (latestLeadEventsError && latestLeadEventsError.code !== "42P01") {
      console.error("Error fetching latest lead events:", {
        message: latestLeadEventsError.message,
        details: latestLeadEventsError.details,
        hint: latestLeadEventsError.hint,
        code: latestLeadEventsError.code,
      })
    } else {
      for (const evt of (latestLeadEvents as ContactEventRow[] | null) || []) {
        if (evt.contact_id && evt.created_at && !latestLeadEventByContactId.has(evt.contact_id)) {
          latestLeadEventByContactId.set(evt.contact_id, evt.created_at)
        }
        if (evt.contact_id && evt.source === "site" && !siteMetaByContactId.has(evt.contact_id)) {
          const payload = evt.payload || {}
          const sourceDomain =
            (typeof payload.source_domain === "string" && payload.source_domain) ||
            (typeof payload.site_slug === "string" && payload.site_slug) ||
            null

          siteMetaByContactId.set(evt.contact_id, {
            source: evt.source,
            domain: sourceDomain,
            lastEventAt: evt.created_at,
          })
        }

        if (evt.contact_id) {
          rememberLeadPropertyReference(evt.contact_id, evt.payload)
        }
      }
    }
  }

  const leadPropertyIds = collectLeadPropertyIds(leadPropertyReferenceByContactId.values())
  const propertyLookupById: Map<string, PropertyLookupRecord> =
    leadPropertyIds.length > 0
      ? await loadLeadPropertyLookupById(supabase, leadPropertyIds)
      : new Map<string, PropertyLookupRecord>()

  if (error) {
    console.error("Error fetching contacts:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
    throw new Error(`Não foi possível carregar contatos: ${error.message ?? "erro desconhecido"}`)
  }

  const assignedProfileIds = Array.from(new Set(((contacts || []) as ContactRow[]).map((contact) => contact.assigned_to).filter(Boolean))) as string[]
  const assignedProfileNameById = new Map<string, string>()

  if (assignedProfileIds.length > 0) {
    const { data: assignedProfiles, error: assignedProfilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", assignedProfileIds)

    if (assignedProfilesError) {
      console.error("Error fetching assigned contact profiles:", {
        message: assignedProfilesError.message,
        details: assignedProfilesError.details,
        hint: assignedProfilesError.hint,
        code: assignedProfilesError.code,
      })
    } else {
      for (const profile of assignedProfiles || []) {
        if (profile.full_name) {
          assignedProfileNameById.set(profile.id, profile.full_name)
        }
      }
    }
  }

  const enrichedContactsBase: EnrichedContactRow[] = ((contacts || []) as ContactRow[]).map((contact) => {
    const leadPropertyContext = buildLeadPropertyContext(
      leadPropertyReferenceByContactId.get(contact.id),
      propertyLookupById
    )

    return {
      ...contact,
      siteMeta: siteMetaByContactId.get(contact.id) ?? null,
      latestLeadAt:
        latestLeadEventByContactId.get(contact.id) ??
        siteMetaByContactId.get(contact.id)?.lastEventAt ??
        null,
      assignedProfileName: contact.assigned_to
        ? assignedProfileNameById.get(contact.assigned_to) ?? null
        : null,
      leadPropertyContext: leadPropertyContext ?? null,
    }
  })

  const enrichedContacts = shouldSortSiteLeadsByLatestEvent
    ? sortByLatestLeadActivity(enrichedContactsBase)
    : enrichedContactsBase

  const totalCount = shouldSortSiteLeadsByLatestEvent ? enrichedContacts.length : count
  const displayContacts =
    view === "board" || !shouldSortSiteLeadsByLatestEvent
      ? enrichedContacts
      : enrichedContacts.slice(start, start + pageSize)
  const totalPages = Math.ceil((totalCount || 0) / pageSize)
  const visibleCount = displayContacts.length
  const rangeStart = totalCount > 0 ? start + 1 : 0
  const rangeEnd = totalCount > 0 ? start + visibleCount : 0

  const buildContactsHref = (overrides: Record<string, string | number | null | undefined>) => {
    const merged: Record<string, string> = {
      view,
      page: String(page),
      pageSize: String(pageSize),
      q,
      status: statusFilter,
      dealStage: dealStageFilter,
      origin: originFilter,
      scope,
      domain: domainFilterRaw,
      domainState: domainStateFilter,
      withPhone: withPhoneFilter,
    }

    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === undefined) {
        delete merged[k]
      } else {
        merged[k] = String(v)
      }
    }

    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(merged)) {
      if (!v) continue
      if (k === "view" && v === "list") continue
      if (k === "page" && v === "1") continue
      if (k === "pageSize" && v === "12") continue
      if (k === "status" && v === "all") continue
      if (k === "dealStage" && v === "all") continue
      if (k === "origin" && v === "all") continue
      if (k === "scope" && v === "all") continue
      if (k === "scope" && v === "site") continue
      if (k === "domainState" && v === "all") continue
      if (k === "withPhone" && v === "all") continue
      params.set(k, v)
    }

    const qs = params.toString()
    return qs ? `${baseRoute}?${qs}` : baseRoute
  }

  const activeFilters: string[] = []
  const singularLabel = scope === "site" ? "lead" : "contato"
  const pluralLabel = scope === "site" ? "leads" : "contatos"

  if (q) activeFilters.push(`Busca: ${q}`)
  if (statusFilter !== "all") activeFilters.push(`Status: ${getContactStatusLabel(statusFilter)}`)
  if (dealStageFilter !== "all" && DEAL_STAGES.includes(dealStageFilter as DealStage)) {
    activeFilters.push(`Funil: ${DEAL_STAGE_LABELS[dealStageFilter as DealStage]}`)
  }
  if (scope !== "site" && originFilter !== "all") {
    activeFilters.push(originFilter === "site" ? "Origem: Site" : `Origem: ${originFilter}`)
  }
  if (domainFilterRaw.trim()) activeFilters.push(`Domínio: ${domainFilterRaw.trim()}`)
  if (scope === "site" && domainStateFilter !== "all") {
    activeFilters.push(domainStateFilter === "known" ? "Domínio no evento: Com domínio" : "Domínio no evento: Sem domínio")
  }
  if (scope === "site" && withPhoneFilter === "yes") activeFilters.push("Telefone: Com telefone")

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{scope === "site" ? "Leads captados pelo site" : "Contatos"}</h1>
          <p className="text-muted-foreground">
            {scope === "site"
              ? "Use Atendimentos para a rotina do dia. Aqui fica o recorte bruto dos leads vindos do site."
              : "Base de dados para consultar e manter leads, clientes e proprietários."}
          </p>
        </div>
        <Link href="/contacts/new">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            {scope === "site" ? "Novo contato manual" : "Novo Contato"}
          </Button>
        </Link>
      </div>

      {scope === "site" ? (
        <div className="flex flex-wrap gap-2">
          <Link href={buildContactsHref({ page: 1, status: "all", domainState: "all", withPhone: "all", domain: null })}>
            <Button
              type="button"
              variant={statusFilter === "all" && domainStateFilter === "all" && withPhoneFilter === "all" && !domainFilterRaw.trim() ? "secondary" : "outline"}
              size="sm"
            >
              Todos os leads
            </Button>
          </Link>
          <Link href={buildContactsHref({ page: 1, status: "new" })}>
            <Button type="button" variant={statusFilter === "new" ? "secondary" : "outline"} size="sm">
              Somente novos
            </Button>
          </Link>
          <Link href={buildContactsHref({ page: 1, domainState: "known" })}>
            <Button type="button" variant={domainStateFilter === "known" ? "secondary" : "outline"} size="sm">
              Com domínio
            </Button>
          </Link>
          <Link href={buildContactsHref({ page: 1, domainState: "unknown" })}>
            <Button type="button" variant={domainStateFilter === "unknown" ? "secondary" : "outline"} size="sm">
              Sem domínio
            </Button>
          </Link>
          <Link href={buildContactsHref({ page: 1, withPhone: "yes" })}>
            <Button type="button" variant={withPhoneFilter === "yes" ? "secondary" : "outline"} size="sm">
              Com telefone
            </Button>
          </Link>
        </div>
      ) : null}

      <ContactsFiltersInstant
        key={`${scope}|${view}|${q}|${statusFilter}|${dealStageFilter}|${originFilter}|${domainFilterRaw}|${domainStateFilter}|${withPhoneFilter}|${pageSize}`}
        baseRoute={baseRoute}
        view={view}
        scope={scope}
        hasActiveFilters={hasFilters}
        initialValues={{
          q,
          status: statusFilter,
          dealStage: dealStageFilter,
          origin: originFilter,
          domain: domainFilterRaw,
          domainState: domainStateFilter,
          withPhone: withPhoneFilter,
          pageSize,
        }}
      />

      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium text-foreground">Recorte ativo</span>
          {activeFilters.map((filter) => (
            <Badge key={filter} variant="secondary" className="font-normal">
              {filter}
            </Badge>
          ))}
          <Link href={view !== "list" ? `${baseRoute}?view=${view}` : baseRoute} className="ml-auto">
            <Button type="button" variant="ghost" size="sm">
              Limpar recorte
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
        <Badge variant={leadDistributionSettings.enabled ? "secondary" : "outline"}>
          Distribuição {leadDistributionSettings.enabled ? "ativa" : "desligada"}
        </Badge>
        <Badge variant="outline">SLA: {leadDistributionSettings.sla_minutes} min</Badge>
        <span className="text-muted-foreground">
          {leadDistributionSettings.enabled
            ? `Novos leads entram com SLA de ${leadDistributionSettings.sla_minutes} min.`
            : "Novos leads não serão distribuídos automaticamente."}
        </span>
        {!leadDistributionSettings.enabled ? (
          <Link href="/settings/leads" className="ml-auto">
            <Button type="button" variant="ghost" size="sm">
              Ajustar distribuição
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="flex items-center justify-end">
        <div className="flex bg-muted rounded-lg p-1">
          <Link href={buildContactsHref({ view: "list", page: 1 })}>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-8 gap-2">
              <Rows3 className="h-4 w-4" />
              Lista
            </Button>
          </Link>
          <Link href={buildContactsHref({ view: "grid", page: 1 })}>
            <Button variant={view === "grid" ? "secondary" : "ghost"} size="sm" className="h-8 gap-2">
              <LayoutGrid className="h-4 w-4" />
              Cards
            </Button>
          </Link>
          <Link href={buildContactsHref({ view: "board", page: 1 })}>
            <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="h-8 gap-2">
              <Kanban className="h-4 w-4" />
              Kanban
            </Button>
          </Link>
        </div>
      </div>

      {displayContacts.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {view === "board"
              ? totalCount > visibleCount
                ? `Mostrando ${visibleCount} de ${totalCount} ${pluralLabel} no kanban.`
                : `${totalCount} ${totalCount === 1 ? singularLabel : pluralLabel} no kanban.`
              : totalCount > visibleCount
              ? `Mostrando ${rangeStart} a ${rangeEnd} de ${totalCount} ${pluralLabel} neste recorte.`
              : `${totalCount} ${totalCount === 1 ? singularLabel : pluralLabel} neste recorte.`}
          </span>
          {view === "board" ? (
            <span>
              {scope === "site"
                ? "Arraste os leads entre as etapas para atualizar o atendimento."
                : "Arraste os contatos entre as etapas para atualizar o atendimento."}
            </span>
          ) : hasFilters ? (
            <span>Use os filtros para ajustar a fila.</span>
          ) : null}
        </div>
      ) : null}

      {view === "board" ? (
        <LeadsKanban
          initialData={enrichedContacts}
          leadDistributionSettings={leadDistributionSettings}
          itemLabel={scope === "site" ? "lead" : "contato"}
        />
      ) : !contacts || contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg bg-muted/20 border-dashed">
          <User className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">
            {scope === "site" ? "Nenhum lead encontrado" : "Nenhum contato encontrado"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            {hasFilters
              ? scope === "site"
                ? "Nenhum lead apareceu neste recorte. Revise os filtros ou limpe o recorte para voltar à fila completa."
                : "Nenhum contato apareceu neste recorte. Revise os filtros ou limpe o recorte para voltar ao funil completo."
              : scope === "site"
                ? "Os leads capturados pelo site aparecerão aqui assim que houver novos envios."
                : "Comece adicionando leads, proprietários ou clientes para organizar seu atendimento."}
          </p>
          {hasFilters ? (
          <Link href={view !== "list" ? `${baseRoute}?view=${view}` : baseRoute}>
            <Button variant="outline">Limpar filtros</Button>
          </Link>
          ) : count === 0 && scope === "site" && !leadDistributionSettings.enabled ? (
            <Link href="/settings/leads">
              <Button variant="outline">Ajustar distribuição</Button>
            </Link>
          ) : count === 0 && scope === "site" ? (
            <Link href="/contacts">
              <Button variant="outline">Ver contatos gerais</Button>
            </Link>
          ) : count === 0 ? (
            <Link href="/contacts/new">
              <Button variant="outline">Cadastrar Primeiro Contato</Button>
            </Link>
          ) : null}
        </div>
      ) : view === "grid" ? (
        <>
          <ContactsGrid contacts={displayContacts} leadDistributionSettings={leadDistributionSettings} />

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <Link href={buildContactsHref({ page: page - 1 })} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                <Button variant="outline" size="sm" disabled={page <= 1}>
                  Anterior
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Link href={buildContactsHref({ page: page + 1 })} className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
                <Button variant="outline" size="sm" disabled={page >= totalPages}>
                  Próxima
                </Button>
              </Link>
            </div>
          )}
        </>
      ) : (
        <>
          <ContactsList contacts={displayContacts} leadDistributionSettings={leadDistributionSettings} />

          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4">
              <Link href={buildContactsHref({ page: page - 1 })} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                <Button variant="outline" size="sm" disabled={page <= 1}>
                  Anterior
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Link href={buildContactsHref({ page: page + 1 })} className={page >= totalPages ? "pointer-events-none opacity-50" : ""}>
                <Button variant="outline" size="sm" disabled={page >= totalPages}>
                  Próxima
                </Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
