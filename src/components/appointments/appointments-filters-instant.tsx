'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useDebounce } from "@/hooks/use-debounce"

type AppointmentsFiltersInstantProps = {
  baseRoute: string
  view: string
  initialValues: {
    q: string
    status: string
  }
}

export function AppointmentsFiltersInstant({
  baseRoute,
  view,
  initialValues,
}: AppointmentsFiltersInstantProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstEffect = useRef(true)

  const [q, setQ] = useState(initialValues.q)
  const [status, setStatus] = useState(initialValues.status)
  const debouncedQ = useDebounce(q, 500)

  const buildQueryString = useCallback(
    (values: { q: string; status: string }) => {
      const params = new URLSearchParams(searchParams.toString())
      const qTrim = values.q.trim()

      if (qTrim) params.set("q", qTrim)
      else params.delete("q")

      if (values.status && values.status !== "all") params.set("status", values.status)
      else params.delete("status")

      if (view && view !== "list") params.set("view", view)
      else params.delete("view")

      return params.toString()
    },
    [searchParams, view]
  )

  useEffect(() => {
    if (isFirstEffect.current) {
      isFirstEffect.current = false
      return
    }

    const nextQuery = buildQueryString({ q: debouncedQ, status })
    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) return

    const hrefBase = pathname || baseRoute
    const href = nextQuery ? `${hrefBase}?${nextQuery}` : hrefBase
    router.replace(href, { scroll: false })
  }, [baseRoute, buildQueryString, debouncedQ, pathname, router, searchParams, status])

  return (
    <form method="get" className="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-4" action={baseRoute}>
      <input type="hidden" name="view" value={view} />
      <div className="md:col-span-2">
        <label className="mb-1 block text-xs text-muted-foreground">Buscar</label>
        <input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cliente, imóvel, telefone ou nota"
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
          <option value="scheduled">Agendado</option>
          <option value="completed">Realizado</option>
          <option value="cancelled">Cancelado</option>
          <option value="no_show">Não Compareceu</option>
        </select>
      </div>
      <div className="flex items-end justify-end gap-2">
        <Button type="submit" variant="outline">
          Aplicar filtros
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const href = view === "calendar" ? `${baseRoute}?view=calendar` : baseRoute
            router.replace(href, { scroll: false })
          }}
        >
          Limpar
        </Button>
      </div>
    </form>
  )
}
