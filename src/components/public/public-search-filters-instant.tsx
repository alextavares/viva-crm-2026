import { PROPERTY_TYPE_OPTIONS } from "@/lib/types"

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
  const hasActiveFilters = Boolean(
    initialValues.q ||
      initialValues.city ||
      initialValues.neighborhood ||
      initialValues.type ||
      initialValues.min_price ||
      initialValues.max_price
  )

  return (
    <form className="mt-4 grid gap-3 sm:grid-cols-2" action={actionPath} method="get">
      <div className="sm:col-span-2">
        <label className="text-xs text-muted-foreground">Palavra-chave</label>
        <input
          name="q"
          defaultValue={initialValues.q}
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder="Ex: V-1200, varanda, suíte, 3 quartos, Maresias"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Cidade</label>
        <input
          name="city"
          defaultValue={initialValues.city}
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder="Ex: São Paulo"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Bairro</label>
        <input
          name="neighborhood"
          defaultValue={initialValues.neighborhood}
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder="Ex: Moema"
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Tipo</label>
        <select
          name="type"
          defaultValue={initialValues.type}
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
        >
          <option value="">Qualquer</option>
          {PROPERTY_TYPE_OPTIONS.map((propertyType) => (
            <option key={propertyType.value} value={propertyType.value}>
              {propertyType.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Min</label>
          <input
            name="min_price"
            inputMode="numeric"
            defaultValue={initialValues.min_price}
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Max</label>
          <input
            name="max_price"
            inputMode="numeric"
            defaultValue={initialValues.max_price}
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            placeholder="0"
          />
        </div>
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          Mostrando {resultCount} resultados nesta página
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasActiveFilters ? (
            <a href={actionPath} className="rounded-2xl border px-4 py-2 text-sm font-medium">
              Limpar filtros
            </a>
          ) : null}
          <button
            type="submit"
            className="rounded-2xl px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--site-secondary)" }}
          >
            Aplicar filtros
          </button>
        </div>
      </div>
    </form>
  )
}
