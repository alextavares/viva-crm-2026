"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useDebounce } from "@/hooks/use-debounce"

type Props = {
  initialValues: {
    q: string
    status: string
    dealStage: string
    priority: string
    assignee: string
    origin: string
  }
}

export function AttendanceFiltersInstant({ initialValues }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const firstEffect = useRef(true)

  const [q, setQ] = useState(initialValues.q)
  const [status, setStatus] = useState(initialValues.status)
  const [dealStage, setDealStage] = useState(initialValues.dealStage)
  const [priority, setPriority] = useState(initialValues.priority)
  const [origin, setOrigin] = useState(initialValues.origin)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(
    initialValues.q.trim().length > 0 ||
      initialValues.status !== "all" ||
      initialValues.dealStage !== "all" ||
      initialValues.priority !== "all" ||
      initialValues.origin !== "all"
  )

  const debouncedQ = useDebounce(q, 500)
  const hasActiveFilters =
    q.trim().length > 0 ||
    status !== "all" ||
    dealStage !== "all" ||
    priority !== "all" ||
    origin !== "all"

  const buildQuery = useCallback(
    (values: {
      q: string
      status: string
      dealStage: string
      priority: string
      origin: string
    }) => {
      const params = new URLSearchParams(searchParams.toString())
      const qTrim = values.q.trim()

      if (qTrim) params.set("q", qTrim)
      else params.delete("q")

      if (values.status !== "all") params.set("status", values.status)
      else params.delete("status")

      if (values.dealStage !== "all") params.set("dealStage", values.dealStage)
      else params.delete("dealStage")

      if (values.priority !== "all") params.set("priority", values.priority)
      else params.delete("priority")

      if (values.origin !== "all") params.set("origin", values.origin)
      else params.delete("origin")

      params.delete("page")
      return params.toString()
    },
    [searchParams]
  )

  useEffect(() => {
    if (firstEffect.current) {
      firstEffect.current = false
      return
    }

    const nextQuery = buildQuery({
      q: debouncedQ,
      status,
      dealStage,
      priority,
      origin,
    })

    if (nextQuery === searchParams.toString()) return

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false })
  }, [buildQuery, debouncedQ, dealStage, origin, pathname, priority, router, searchParams, status])

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-3 md:hidden">
        <div>
          <div className="text-sm font-medium text-foreground">Filtros da fila</div>
          <div className="text-xs text-muted-foreground">
            {hasActiveFilters ? "Há filtros ativos no recorte atual." : "Abra apenas se precisar refinar a fila."}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setMobileFiltersOpen((current) => !current)}>
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          {mobileFiltersOpen ? "Fechar" : "Filtrar"}
          <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${mobileFiltersOpen ? "rotate-180" : ""}`} />
        </Button>
      </div>

      <form
        method="get"
        action="/attendances"
        className={`${mobileFiltersOpen ? "grid" : "hidden"} gap-3 p-3 md:grid md:grid-cols-5 md:p-3`}
      >
        <input type="hidden" name="assignee" value={initialValues.assignee} />
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs text-muted-foreground">Buscar atendimento</label>
          <input
            name="q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Nome, telefone ou email"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Situação</label>
          <select
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Todos</option>
            <option value="new">Novo</option>
            <option value="contacted">Em atendimento</option>
            <option value="qualified">Qualificado</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Prioridade</label>
          <select
            name="priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Todas</option>
            <option value="critical">SLA atrasado</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Origem</label>
          <select
            name="origin"
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Todas</option>
            <option value="site">Site</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Funil</label>
          <select
            name="dealStage"
            value={dealStage}
            onChange={(event) => setDealStage(event.target.value)}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">Todos</option>
            <option value="lead">Lead</option>
            <option value="interest">Interesse</option>
            <option value="visit">Visita</option>
            <option value="negotiation">Negociação</option>
            <option value="closing">Fechamento</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-2 md:col-span-4">
          <span className="text-xs text-muted-foreground">Os filtros são aplicados automaticamente.</span>
          <Button type="button" variant="ghost" onClick={() => router.replace("/attendances", { scroll: false })}>
            Limpar filtros
          </Button>
        </div>
      </form>
    </div>
  )
}
