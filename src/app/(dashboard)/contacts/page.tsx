import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ContactActions } from "@/components/contacts/contact-card-actions"
import { SiteContactQuickActions } from "@/components/contacts/site-contact-quick-actions"
import { LeadsKanban } from "@/components/leads/leads-kanban"
import { createClient } from "@/lib/supabase/server"
import type { Contact } from "@/lib/types"
import { Building, Globe, Kanban, LayoutGrid, Mail, Phone, Plus, User } from "lucide-react"

type ContactRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  type: string
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

function getTypeLabel(type: string) {
  switch (type) {
    case "lead":
      return "Lead"
    case "client":
      return "Cliente"
    case "owner":
      return "Proprietário"
    case "partner":
      return "Parceiro"
    default:
      return type
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case "new":
      return "Novo"
    case "contacted":
      return "Contactado"
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

function getStatusColor(status: string) {
  switch (status) {
    case "new":
      return "default"
    case "qualified":
      return "secondary"
    case "won":
      return "outline"
    case "lost":
      return "destructive"
    default:
      return "outline"
  }
}

function formatDateTime(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
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
  const originFilter = typeof resolvedSearchParams?.origin === "string" ? resolvedSearchParams.origin : "all"
  const scope = typeof resolvedSearchParams?.scope === "string" ? resolvedSearchParams.scope : "all"
  const domainFilterRaw = typeof resolvedSearchParams?.domain === "string" ? resolvedSearchParams.domain : ""
  const domainStateFilterRaw = typeof resolvedSearchParams?.domainState === "string" ? resolvedSearchParams.domainState : "all"
  const domainStateFilter =
    domainStateFilterRaw === "known" || domainStateFilterRaw === "unknown" ? domainStateFilterRaw : "all"
  const withPhoneFilter = typeof resolvedSearchParams?.withPhone === "string" ? resolvedSearchParams.withPhone : "all"
  const domainFilter = domainFilterRaw.trim().toLowerCase()
  const baseRoute = scope === "site" ? "/contacts/site" : "/contacts"

  const start = (page - 1) * pageSize
  const end = start + pageSize - 1

  const shouldFilterBySiteEvent = originFilter === "site" || domainFilter.length > 0
  const siteMetaByContactId = new Map<string, SiteMeta>()
  let siteContactIds: string[] | null = null

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

    if (withPhoneFilter === "yes") {
      query = query.not("phone", "is", null).neq("phone", "")
    }

    if (shouldFilterBySiteEvent && siteContactIds) {
      query = query.in("id", siteContactIds)
    }

    if (view === "board") {
      query = query.range(0, 999)
    } else {
      query = query.range(start, end)
    }

    const queryResult = await query
    contacts = (queryResult.data as ContactRow[] | null) || []
    count = queryResult.count || 0
    error = queryResult.error as { message?: string; details?: string; hint?: string; code?: string } | null
  }

  if (error) {
    console.error("Error fetching contacts:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    })
  }

  const totalPages = Math.ceil((count || 0) / pageSize)
  const kanbanData: Contact[] = ((contacts || []) as ContactRow[]).map((c) => ({
    ...c,
    email: c.email ?? undefined,
    phone: c.phone ?? undefined,
    created_at: c.created_at ?? undefined,
    updated_at: c.updated_at ?? undefined,
  }))

  const buildContactsHref = (overrides: Record<string, string | number | null | undefined>) => {
    const merged: Record<string, string> = {
      view,
      page: String(page),
      pageSize: String(pageSize),
      q,
      status: statusFilter,
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold md:text-2xl">{scope === "site" ? "Contatos do Site" : "Contatos"}</h1>
          <p className="text-muted-foreground">
            {scope === "site"
              ? "Leads capturados pelo site público e domínio próprio."
              : "Gerencie seus leads e clientes."}
          </p>
        </div>
        <Link href="/contacts/new">
          <Button className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Novo Contato
          </Button>
        </Link>
      </div>

      {scope === "site" ? (
        <div className="flex flex-wrap gap-2">
          <Link href={buildContactsHref({ page: 1, status: "all", domainState: "all", withPhone: "all", domain: null })}>
            <Button type="button" variant="outline" size="sm">Todos os leads</Button>
          </Link>
          <Link href={buildContactsHref({ page: 1, status: "new" })}>
            <Button type="button" variant="outline" size="sm">Somente novos</Button>
          </Link>
          <Link href={buildContactsHref({ page: 1, domainState: "known" })}>
            <Button type="button" variant="outline" size="sm">Com domínio</Button>
          </Link>
          <Link href={buildContactsHref({ page: 1, domainState: "unknown" })}>
            <Button type="button" variant="outline" size="sm">Sem domínio</Button>
          </Link>
          <Link href={buildContactsHref({ page: 1, withPhone: "yes" })}>
            <Button type="button" variant="outline" size="sm">Com WhatsApp</Button>
          </Link>
        </div>
      ) : null}

      <form method="get" className="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-6">
        <input type="hidden" name="view" value={view} />
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">Buscar</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Nome, email ou telefone"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Status</label>
          <select name="status" defaultValue={statusFilter} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
            <option value="all">Todos</option>
            <option value="new">Novo</option>
            <option value="contacted">Contactado</option>
            <option value="qualified">Qualificado</option>
            <option value="lost">Perdido</option>
            <option value="won">Ganho</option>
          </select>
        </div>
        {scope === "site" ? (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Origem</label>
            <input
              value="Site"
              readOnly
              className="h-9 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground"
            />
            <input type="hidden" name="origin" value="site" />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Origem</label>
            <select name="origin" defaultValue={originFilter} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="all">Todas</option>
              <option value="site">Site</option>
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Domínio/Site</label>
          <input
            name="domain"
            defaultValue={domainFilterRaw}
            placeholder="ex: demo-vivacrm ou www..."
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
        {scope === "site" ? (
          <>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Domínio no evento</label>
              <select name="domainState" defaultValue={domainStateFilter} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="all">Todos</option>
                <option value="known">Com domínio</option>
                <option value="unknown">Sem domínio</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Telefone</label>
              <select name="withPhone" defaultValue={withPhoneFilter} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="all">Todos</option>
                <option value="yes">Com WhatsApp</option>
              </select>
            </div>
          </>
        ) : null}
        <div className="md:col-span-6 flex justify-end gap-2">
          <Button type="submit" variant="outline">
            Aplicar filtros
          </Button>
          <Link href={scope === "site" ? buildContactsHref({ q: null, status: "all", domain: null, domainState: "all", withPhone: "all", page: 1 }) : view === "board" ? "/contacts?view=board" : "/contacts"}>
            <Button type="button" variant="ghost">
              Limpar
            </Button>
          </Link>
        </div>
      </form>

      <div className="flex items-center justify-end">
        <div className="flex bg-muted rounded-lg p-1">
          <Link href={buildContactsHref({ view: "list", page: 1 })}>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-8 gap-2">
              <LayoutGrid className="h-4 w-4" />
              Lista
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

      {view === "board" ? (
        <LeadsKanban initialData={kanbanData} />
      ) : !contacts || contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center border rounded-lg bg-muted/20 border-dashed">
          <User className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Nenhum contato encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Ajuste os filtros ou comece adicionando leads, proprietários ou clientes.
          </p>
          {count === 0 && (
            <Link href="/contacts/new">
              <Button variant="outline">Cadastrar Primeiro Contato</Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contacts.map((contact) => {
              const siteMeta = siteMetaByContactId.get(contact.id)
              return (
                <div key={contact.id} className="relative group">
                  <Link href={`/contacts/${contact.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <Avatar>
                          <AvatarImage src={`https://ui-avatars.com/api/?name=${contact.name}&background=random`} />
                          <AvatarFallback>{contact.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <CardTitle className="text-base">{contact.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{getTypeLabel(contact.type)}</p>
                        </div>
                        <Badge variant={getStatusColor(contact.status) as "default" | "secondary" | "destructive" | "outline"} className="ml-auto">
                          {getStatusLabel(contact.status)}
                        </Badge>
                      </CardHeader>
                      <CardContent className="grid gap-2 text-sm">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                        {siteMeta ? (
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
                            <Badge variant="secondary">Site</Badge>
                            <Globe className="h-3 w-3" />
                            <span className="truncate">{siteMeta.domain || "sem domínio informado"}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t">
                            <Building className="h-3 w-3" />
                            <span>Organização</span>
                          </div>
                        )}
                        {siteMeta?.lastEventAt ? (
                          <div className="text-xs text-muted-foreground">
                            Último lead: {formatDateTime(siteMeta.lastEventAt)}
                          </div>
                        ) : null}

                        {siteMeta && (
                          <SiteContactQuickActions
                            contactId={contact.id}
                            phone={contact.phone}
                            status={contact.status}
                          />
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                  <ContactActions contactId={contact.id} />
                </div>
              )
            })}
          </div>

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
