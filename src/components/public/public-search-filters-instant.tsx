'use client'

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useDebounce } from "@/hooks/use-debounce"

type PublicSearchFiltersInstantProps = {
  actionPath: string
  resultCount: number
  initialValues: {
    q: string
    city: string
    neighborhood: string
    type: string
    min_price: string
    max_price: string
  }
}

export function PublicSearchFiltersInstant({
  actionPath,
  resultCount,
  initialValues,
}: PublicSearchFiltersInstantProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstEffect = useRef(true)

  const [q, setQ] = useState(initialValues.q)
  const [city, setCity] = useState(initialValues.city)
  const [neighborhood, setNeighborhood] = useState(initialValues.neighborhood)
  const [type, setType] = useState(initialValues.type)
  const [minPrice, setMinPrice] = useState(initialValues.min_price)
  const [maxPrice, setMaxPrice] = useState(initialValues.max_price)

  const debouncedQ = useDebounce(q, 500)
  const debouncedCity = useDebounce(city, 500)
  const debouncedNeighborhood = useDebounce(neighborhood, 500)
  const debouncedMinPrice = useDebounce(minPrice, 500)
  const debouncedMaxPrice = useDebounce(maxPrice, 500)

  const buildQueryString = useCallback(
    (values: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(values)) {
        const trimmedValue = value.trim()
        if (!trimmedValue) {
          params.delete(key)
          continue
        }
        params.set(key, trimmedValue)
      }

      // Any filter change must restart at page 1.
      params.delete("page")
      return params.toString()
    },
    [searchParams]
  )

  useEffect(() => {
    if (isFirstEffect.current) {
      isFirstEffect.current = false
      return
    }

    const nextQuery = buildQueryString({
      q: debouncedQ,
      city: debouncedCity,
      neighborhood: debouncedNeighborhood,
      type,
      min_price: debouncedMinPrice,
      max_price: debouncedMaxPrice,
    })

    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) return

    const href = nextQuery ? `${pathname}?${nextQuery}` : pathname
    router.replace(href, { scroll: false })
  }, [
    buildQueryString,
    debouncedCity,
    debouncedMaxPrice,
    debouncedMinPrice,
    debouncedNeighborhood,
    debouncedQ,
    pathname,
    router,
    searchParams,
    type,
  ])

  return (
    <form className="mt-4 grid gap-3 sm:grid-cols-2" action={actionPath} method="get">
      <div className="sm:col-span-2">
        <label className="text-xs text-muted-foreground">Palavra-chave</label>
        <input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder="Ex: V-1200, varanda, suíte, 77848263, UUID"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Cidade</label>
        <input
          name="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder="Ex: São Paulo"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Bairro</label>
        <input
          name="neighborhood"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder="Ex: Moema"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Tipo</label>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
        >
          <option value="">Qualquer</option>
          <option value="apartment">Apartamento</option>
          <option value="house">Casa</option>
          <option value="land">Terreno</option>
          <option value="commercial">Comercial</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Min</label>
          <input
            name="min_price"
            inputMode="numeric"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Max</label>
          <input
            name="max_price"
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            placeholder="0"
          />
        </div>
      </div>
      <div className="sm:col-span-2 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Mostrando {resultCount} resultados nesta página
        </div>
        <button
          type="submit"
          className="rounded-2xl px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "var(--site-secondary)" }}
        >
          Aplicar filtros
        </button>
      </div>
    </form>
  )
}
