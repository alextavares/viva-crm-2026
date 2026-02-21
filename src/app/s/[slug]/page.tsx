import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { siteListProperties, type SitePropertyCard } from "@/lib/site"
import type { Metadata } from "next"
import { getPublicLinks, getPublicNewsList, getPublicSite } from "@/lib/public-site/site-data"
import { truncate, withBase } from "@/lib/public-site/seo"
import { getRequestHost, publicBasePath } from "@/lib/public-site/host"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"
import { HeroBanner } from "@/components/public/site-banners"
import { PublicSearchFiltersInstant } from "@/components/public/public-search-filters-instant"

function formatMoneyBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0)
}

function formatDatePt(v: string | null | undefined) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(d)
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
  const [news, links] = await Promise.all([
    getPublicNewsList(site.slug, 3, 0),
    getPublicLinks(site.slug),
  ])

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
          <PublicSearchFiltersInstant
            actionPath={homeHref}
            resultCount={list.length}
            initialValues={{
              q: q ?? "",
              city: city ?? "",
              neighborhood: neighborhood ?? "",
              type: type ?? "",
              min_price: minPrice != null ? String(minPrice) : "",
              max_price: maxPrice != null ? String(maxPrice) : "",
            }}
          />
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
                  <div className="mt-1 text-xs text-muted-foreground">
                    Ref: {p.public_code || p.id.slice(0, 8)}
                  </div>
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

      {news.length > 0 ? (
        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold">Notícias</h2>
            <Link
              href={`${homeHref === "/" ? "" : homeHref}/noticias`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Ver todas
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {news.map((n) => (
              <Link
                key={n.id}
                href={`${homeHref === "/" ? "" : homeHref}/noticias/${n.slug}`}
                className="rounded-3xl border bg-white/85 p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="text-xs text-muted-foreground">
                  {formatDatePt(n.published_at || n.created_at) || "Publicação recente"}
                </div>
                <div className="mt-2 line-clamp-2 text-base font-semibold">{n.title}</div>
                <div className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {n.excerpt || "Leia o conteúdo completo desta publicação no site."}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {links.length > 0 ? (
        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold">Links úteis</h2>
            <Link
              href={`${homeHref === "/" ? "" : homeHref}/links`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Ver todos
            </Link>
          </div>
          <div className="rounded-3xl border bg-white/85 p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2">
              {links.slice(0, 6).map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl border bg-white px-4 py-3 transition-colors hover:bg-muted/30"
                >
                  <div className="text-sm font-medium">{item.title}</div>
                  {item.description ? (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</div>
                  ) : null}
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}
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
