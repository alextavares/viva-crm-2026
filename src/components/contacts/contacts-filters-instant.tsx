'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useDebounce } from "@/hooks/use-debounce"

type ContactsFiltersInstantProps = {
  baseRoute: string
  view: string
  scope: string
  hasActiveFilters: boolean
  initialValues: {
    q: string
    status: string
    dealStage: string
    origin: string
    domain: string
    domainState: string
    withPhone: string
    pageSize: number
  }
}

export function ContactsFiltersInstant({
  baseRoute,
  view,
  scope,
  hasActiveFilters,
  initialValues,
}: ContactsFiltersInstantProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstEffect = useRef(true)

  const [q, setQ] = useState(initialValues.q)
  const [status, setStatus] = useState(initialValues.status)
  const [dealStage, setDealStage] = useState(initialValues.dealStage)
  const [origin, setOrigin] = useState(initialValues.origin)
  const [domain, setDomain] = useState(initialValues.domain)
  const [domainState, setDomainState] = useState(initialValues.domainState)
  const [withPhone, setWithPhone] = useState(initialValues.withPhone)

  const debouncedQ = useDebounce(q, 500)
  const debouncedDomain = useDebounce(domain, 500)

  const buildQueryString = useCallback(
    (values: {
      q: string
      status: string
      dealStage: string
      origin: string
      domain: string
      domainState: string
      withPhone: string
    }) => {
      const params = new URLSearchParams(searchParams.toString())
      const qTrim = values.q.trim()
      const domainTrim = values.domain.trim()

      if (qTrim) params.set("q", qTrim)
      else params.delete("q")

      if (values.status && values.status !== "all") params.set("status", values.status)
      else params.delete("status")

      if (values.dealStage && values.dealStage !== "all") params.set("dealStage", values.dealStage)
      else params.delete("dealStage")

      if (scope !== "site" && values.origin && values.origin !== "all") params.set("origin", values.origin)
      else params.delete("origin")

      if (domainTrim) params.set("domain", domainTrim)
      else params.delete("domain")

      if (values.domainState && values.domainState !== "all") params.set("domainState", values.domainState)
      else params.delete("domainState")

      if (values.withPhone && values.withPhone !== "all") params.set("withPhone", values.withPhone)
      else params.delete("withPhone")

      if (view && view !== "list") params.set("view", view)
      else params.delete("view")

      if (initialValues.pageSize !== 12) params.set("pageSize", String(initialValues.pageSize))
      else params.delete("pageSize")

      params.delete("page")
      params.delete("scope")

      return params.toString()
    },
    [initialValues.pageSize, scope, searchParams, view]
  )

  useEffect(() => {
    if (isFirstEffect.current) {
      isFirstEffect.current = false
      return
    }

    const nextQuery = buildQueryString({
      q: debouncedQ,
      status,
      dealStage,
      origin,
      domain: debouncedDomain,
      domainState,
      withPhone,
    })

    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) return

    const hrefBase = pathname || baseRoute
    const href = nextQuery ? `${hrefBase}?${nextQuery}` : hrefBase
    router.replace(href, { scroll: false })
  }, [
    baseRoute,
    buildQueryString,
    debouncedDomain,
    debouncedQ,
    dealStage,
    domainState,
    origin,
    pathname,
    router,
    searchParams,
    status,
    withPhone,
  ])

  return (
    <form method="get" className="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-7" action={baseRoute}>
      <input type="hidden" name="view" value={view} />
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-muted-foreground">Buscar contato</label>
        <input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome, email ou telefone"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Status</label>
        <select
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Todos</option>
          <option value="new">Novo</option>
          <option value="contacted">Em atendimento</option>
          <option value="qualified">Qualificado</option>
          <option value="lost">Perdido</option>
          <option value="won">Ganho</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Funil comercial</label>
        <select
          name="dealStage"
          value={dealStage}
          onChange={(e) => setDealStage(e.target.value)}
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">Todos</option>
          <option value="lead">Lead</option>
          <option value="interest">Interesse</option>
          <option value="visit">Visita</option>
          <option value="negotiation">Negociação</option>
          <option value="closing">Fechamento</option>
          <option value="won">Ganho</option>
          <option value="lost">Perdido</option>
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
          <select
            name="origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Todas</option>
            <option value="site">Site</option>
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">Outras origens aparecem direto na ficha do contato.</p>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Domínio do site</label>
        <input
          name="domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="ex: demo-vivacrm ou www..."
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
      </div>

      {scope === "site" ? (
        <>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Domínio no evento</label>
            <select
              name="domainState"
              value={domainState}
              onChange={(e) => setDomainState(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Todos</option>
              <option value="known">Com domínio</option>
              <option value="unknown">Sem domínio</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Telefone</label>
            <select
              name="withPhone"
              value={withPhone}
              onChange={(e) => setWithPhone(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Todos</option>
              <option value="yes">Com telefone</option>
            </select>
          </div>
        </>
      ) : null}

      <div className="md:col-span-6 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Os filtros são aplicados automaticamente.</span>
        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              const href = view === "board" ? `${baseRoute}?view=board` : baseRoute
              router.replace(href, { scroll: false })
            }}
          >
            Limpar filtros
          </Button>
        ) : null}
      </div>
    </form>
  )
}
