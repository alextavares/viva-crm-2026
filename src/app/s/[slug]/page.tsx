import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { siteListProperties, type SitePropertyCard } from "@/lib/site"
import type { Metadata } from "next"
import { getPublicSite } from "@/lib/public-site/site-data"
import { truncate, withBase } from "@/lib/public-site/seo"
import { getRequestHost, publicBasePath } from "@/lib/public-site/host"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"
import { HeroBanner } from "@/components/public/site-banners"

function formatMoneyBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0)
}

function asString(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0]
  return v
}

function asNonEmptyString(v: string | string[] | undefined) {
  const s = asString(v)
  if (!s) return null
  const t = s.trim()
  return t.length > 0 ? t : null
}

function asNumber(v: string | string[] | undefined) {
  const s = asString(v)
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function normalizeMinPrice(v: number | null) {
  if (v == null) return null
  // Users often type 0 meaning "no minimum". Keep 0 (no-op) and drop negatives.
  if (v < 0) return null
  return v
}

function normalizeMaxPrice(v: number | null) {
  if (v == null) return null
  // Users often type 0 meaning "no maximum". Treat 0 (or negatives) as unset.
  if (v <= 0) return null
  return v
}

function buildHref(base: string, params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue
    sp.set(k, String(v))
  }
  const qs = sp.toString()
  return qs ? `${base}?${qs}` : base
}

export default async function PublicSiteHome({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const site = await getPublicSite(slug)
  if (!site) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-2xl font-semibold">Site não encontrado</h1>
      </main>
    )
  }

  const supabase = await createClient()

  // Treat empty strings as "unset" so query params like `type=` don't filter everything out.
  const q = asNonEmptyString(sp.q)
  const city = asNonEmptyString(sp.city)
  const neighborhood = asNonEmptyString(sp.neighborhood)
  const type = asNonEmptyString(sp.type)
  const minPrice = normalizeMinPrice(asNumber(sp.min_price))
  const maxPrice = normalizeMaxPrice(asNumber(sp.max_price))
  const page = Math.max(1, Math.floor(asNumber(sp.page) ?? 1))

  const limit = 24
  const offset = (page - 1) * limit

  const { data: items } = await siteListProperties(supabase, {
    siteSlug: site.slug,
    q,
    city,
    neighborhood,
    type,
    minPrice,
    maxPrice,
    limit,
    offset,
  })

  const list: SitePropertyCard[] = items ?? []
  const brandName = site.settings?.brand_name || site.slug
  const heroBanner = site.banners.find((b) => b.placement === "hero") ?? null

  const host = await getRequestHost()
  const base = publicBasePath(site.slug, host)
  const homeHref = base || "/"

  const queryBase = { q, city, neighborhood, type, min_price: minPrice, max_price: maxPrice }
  const prevHref = buildHref(homeHref, { ...queryBase, page: page > 1 ? page - 1 : null })
  const nextHref = buildHref(homeHref, { ...queryBase, page: page + 1 })

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {heroBanner ? <HeroBanner banner={heroBanner} /> : null}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border bg-white/80 p-7 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {brandName}
          </p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight">
            Encontre seu imóvel com{" "}
            <span style={{ color: "var(--site-secondary)" }}>busca rápida</span> e atendimento humano.
          </h1>
          <p className="mt-3 max-w-prose text-muted-foreground">
            Filtre por cidade, bairro e faixa de preço. Se preferir, fale direto no WhatsApp.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href="#buscar"
              className="rounded-2xl px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--site-primary)" }}
            >
              Buscar imóveis
            </a>
            <Link
              href={`${homeHref === "/" ? "" : homeHref}/contact`}
              className="rounded-2xl border px-4 py-2 text-sm font-medium"
            >
              Contato
            </Link>
          </div>
        </div>

        <div id="buscar" className="rounded-3xl border bg-white/80 p-7 shadow-sm">
          <div className="text-sm font-medium">Busca</div>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" action={homeHref} method="get">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground">Palavra-chave</label>
              <input
                name="q"
                defaultValue={q ?? ""}
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="Ex: varanda, suíte, 77848263, UUID"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cidade</label>
              <input
                name="city"
                defaultValue={city ?? ""}
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="Ex: São Paulo"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Bairro</label>
              <input
                name="neighborhood"
                defaultValue={neighborhood ?? ""}
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                placeholder="Ex: Moema"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <select
                name="type"
                defaultValue={type ?? ""}
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
                  defaultValue={minPrice ?? ""}
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Max</label>
                <input
                  name="max_price"
                  inputMode="numeric"
                  defaultValue={maxPrice ?? ""}
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Mostrando {list.length} resultados nesta página
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
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold">Imóveis</h2>
          <div className="flex items-center gap-2">
            <Link
              href={prevHref}
              className={`rounded-xl border px-3 py-2 text-sm font-medium ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              Anterior
            </Link>
            <Link className="rounded-xl border px-3 py-2 text-sm font-medium" href={nextHref}>
              Próxima
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const thumbnailSrc =
              resolveMediaPathUrl("properties", p.thumbnail_path) ??
              resolveMediaUrl(p.thumbnail_url) ??
              p.thumbnail_url ??
              undefined

            return (
              <Link
                key={p.id}
                href={`${homeHref === "/" ? "" : homeHref}/imovel/${p.id}`}
                className="group overflow-hidden rounded-3xl border bg-white/85 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="aspect-[4/3] bg-muted">
                  {thumbnailSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailSrc}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : null}
                </div>
                <div className="p-5">
                  <div className="text-sm font-medium line-clamp-1">{p.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    {p.neighborhood || p.city ? `${p.neighborhood || ""}${p.city ? ` - ${p.city}` : ""}` : "Localização a informar"}
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div className="text-lg font-semibold" style={{ color: "var(--site-primary)" }}>
                      {formatMoneyBRL(p.price)}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.type || ""}</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {list.length === 0 ? (
          <div className="mt-10 rounded-3xl border bg-white/80 p-8 text-sm text-muted-foreground">
            Nenhum imóvel encontrado com os filtros atuais.
          </div>
        ) : null}
      </section>
    </main>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const site = await getPublicSite(slug)
  if (!site) return withBase({ title: "Site não encontrado" })

  const brandName = site.settings?.brand_name || site.slug
  const description = truncate(
    `Veja os imóveis anunciados por ${brandName}. Filtre por cidade, bairro e faixa de preço e fale direto no WhatsApp.`
  )

  return withBase({
    title: brandName,
    description,
    alternates: { canonical: `/s/${site.slug}` },
    openGraph: {
      title: brandName,
      description,
      url: `/s/${site.slug}`,
    },
  })
}
