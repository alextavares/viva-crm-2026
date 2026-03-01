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
  const isPremium = site.settings?.theme === "premium"

  const host = await getRequestHost()
  const base = publicBasePath(site.slug, host)
  const homeHref = base || "/"

  const queryBase = { q, city, neighborhood, type, min_price: minPrice, max_price: maxPrice }
  const prevHref = buildHref(homeHref, { ...queryBase, page: page > 1 ? page - 1 : null })
  const nextHref = buildHref(homeHref, { ...queryBase, page: page + 1 })
  const featuredSelection = list.slice(0, 3)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {heroBanner ? <HeroBanner banner={heroBanner} /> : null}

      <section className={`grid gap-6 ${isPremium ? "lg:grid-cols-[1.2fr_0.8fr]" : "lg:grid-cols-[1.1fr_0.9fr]"}`}>
        <div className={`border bg-white/80 shadow-sm ${isPremium ? "rounded-[2rem] p-8 md:p-10" : "rounded-3xl p-7"}`}>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {isPremium ? "Curadoria imobiliária" : brandName}
          </p>
          <h1 className={`mt-3 leading-tight ${isPremium ? "max-w-xl text-4xl font-serif md:text-5xl" : "text-4xl font-semibold"}`}>
            {isPremium ? (
              <>
                Imóveis com apresentação{" "}
                <span style={{ color: "var(--site-secondary)" }}>mais elegante</span> e atendimento consultivo.
              </>
            ) : (
              <>
                Encontre seu imóvel com{" "}
                <span style={{ color: "var(--site-secondary)" }}>busca rápida</span> e atendimento humano.
              </>
            )}
          </h1>
          <p className="mt-3 max-w-prose text-muted-foreground">
            {isPremium
              ? "Seleção visual de imóveis com destaque para imagem, contexto e experiência de marca."
              : "Filtre por cidade, bairro e faixa de preço. Se preferir, fale direto no WhatsApp."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href="#buscar"
              className={`px-4 py-2 text-sm font-medium text-white ${isPremium ? "rounded-full" : "rounded-2xl"}`}
              style={{ backgroundColor: "var(--site-primary)" }}
            >
              {isPremium ? "Explorar imóveis" : "Buscar imóveis"}
            </a>
            <Link
              href={`${homeHref === "/" ? "" : homeHref}/contact`}
              className={`${isPremium ? "rounded-full" : "rounded-2xl"} border px-4 py-2 text-sm font-medium`}
            >
              {isPremium ? "Fale com um especialista" : "Contato"}
            </Link>
          </div>
        </div>

        <div id="buscar" className={`border bg-white/80 shadow-sm ${isPremium ? "rounded-[2rem] p-8" : "rounded-3xl p-7"}`}>
          <div className="text-sm font-medium">{isPremium ? "Curadoria guiada" : "Busca"}</div>
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

      {isPremium ? (
        <>
          <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[2rem] border bg-white/85 p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Posicionamento
              </p>
              <h2 className="mt-3 text-3xl font-serif leading-tight">
                Uma vitrine pensada para valorizar o imovel antes do primeiro atendimento.
              </h2>
              <p className="mt-3 max-w-prose text-sm text-muted-foreground">
                O template Premium reforca imagem, contexto e percepcao de exclusividade para operacoes com ticket
                maior ou marca mais consultiva.
              </p>
            </div>
            <div className="rounded-[2rem] border bg-white/85 p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Atendimento
              </p>
              <div className="mt-3 text-lg font-semibold">Fale com a equipe e receba uma selecao alinhada ao seu perfil.</div>
              <p className="mt-2 text-sm text-muted-foreground">
                O contato entra no CRM e o time retorna com abordagem consultiva via WhatsApp, telefone ou e-mail.
              </p>
              <Link
                href={`${homeHref === "/" ? "" : homeHref}/contact`}
                className="mt-5 inline-flex rounded-full border px-4 py-2 text-sm font-medium"
              >
                Solicitar atendimento
              </Link>
            </div>
          </section>

          {featuredSelection.length > 0 ? (
            <section className="mt-10">
              <div className="mb-5 flex items-end justify-between gap-4">
                <h2 className="text-2xl font-semibold">Selecao da semana</h2>
                <a href="#buscar" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                  Refinar busca
                </a>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                <Link
                  href={`${homeHref === "/" ? "" : homeHref}/imovel/${featuredSelection[0].id}`}
                  className="group overflow-hidden rounded-[2rem] border bg-white/85 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="aspect-[16/9] bg-muted">
                    {(() => {
                      const heroSrc =
                        resolveMediaPathUrl("properties", featuredSelection[0].thumbnail_path) ??
                        resolveMediaUrl(featuredSelection[0].thumbnail_url) ??
                        featuredSelection[0].thumbnail_url ??
                        undefined
                      return heroSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={heroSrc}
                          alt={featuredSelection[0].title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : null
                    })()}
                  </div>
                  <div className="p-6">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Destaque Premium
                    </div>
                    <div className="mt-2 text-2xl font-serif">{featuredSelection[0].title}</div>
                    <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {featuredSelection[0].neighborhood || featuredSelection[0].city
                        ? `${featuredSelection[0].neighborhood || ""}${featuredSelection[0].city ? ` - ${featuredSelection[0].city}` : ""}`
                        : "Localizacao a informar"}
                    </div>
                    <div className="mt-5 text-xl font-semibold" style={{ color: "var(--site-primary)" }}>
                      {formatMoneyBRL(featuredSelection[0].price)}
                    </div>
                  </div>
                </Link>
                <div className="grid gap-4">
                  {featuredSelection.slice(1).map((p) => {
                    const thumbnailSrc =
                      resolveMediaPathUrl("properties", p.thumbnail_path) ??
                      resolveMediaUrl(p.thumbnail_url) ??
                      p.thumbnail_url ??
                      undefined

                    return (
                      <Link
                        key={p.id}
                        href={`${homeHref === "/" ? "" : homeHref}/imovel/${p.id}`}
                        className="group overflow-hidden rounded-[2rem] border bg-white/85 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="grid md:grid-cols-[0.46fr_0.54fr]">
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
                            <div className="line-clamp-2 text-base font-semibold">{p.title}</div>
                            <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                              {p.neighborhood || p.city
                                ? `${p.neighborhood || ""}${p.city ? ` - ${p.city}` : ""}`
                                : "Localizacao a informar"}
                            </div>
                            <div className="mt-4 text-lg font-semibold" style={{ color: "var(--site-primary)" }}>
                              {formatMoneyBRL(p.price)}
                            </div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="mt-10 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border bg-white/85 p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                "Atendimento rapido pelo WhatsApp",
                "Busca objetiva por cidade e bairro",
                "Lead entra direto no CRM da equipe",
              ].map((item) => (
                <div key={item} className="rounded-2xl border bg-muted/10 p-4 text-sm font-medium">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border bg-white/85 p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Atalhos</div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <a href="#buscar" className="rounded-2xl border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/30">
                Comprar
              </a>
              <a href="#buscar" className="rounded-2xl border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/30">
                Alugar
              </a>
              <Link
                href={`${homeHref === "/" ? "" : homeHref}/contact`}
                className="rounded-2xl border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/30"
              >
                Anunciar meu imovel
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {isPremium ? "Curadoria ativa" : "Busca objetiva"}
            </div>
            <h2 className="mt-1 text-2xl font-semibold">{isPremium ? "Portfolio de imoveis" : "Imoveis"}</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              {isPremium
                ? "Cards mais amplos para comparar contexto, preco e qualidade de apresentacao."
                : "Leitura rapida para encontrar opcoes e entrar em contato com menos friccao."}
            </div>
          </div>
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

        <div className={`mt-6 grid gap-4 ${isPremium ? "lg:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
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
                className={`group overflow-hidden border bg-white/85 shadow-sm transition-shadow hover:shadow-md ${isPremium ? "rounded-[2rem]" : "rounded-3xl"}`}
              >
                <div className={`bg-muted ${isPremium ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
                  {thumbnailSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailSrc}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : null}
                </div>
                <div className={isPremium ? "p-6" : "p-5"}>
                  <div className={`line-clamp-1 ${isPremium ? "text-lg font-semibold" : "text-sm font-medium"}`}>{p.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    {p.neighborhood || p.city ? `${p.neighborhood || ""}${p.city ? ` - ${p.city}` : ""}` : "Localização a informar"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Ref: {p.public_code || p.id.slice(0, 8)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className={`${isPremium ? "rounded-full" : "rounded-2xl"} border bg-white px-2.5 py-1`}>
                      {p.type || "Tipo a informar"}
                    </span>
                    <span className={`${isPremium ? "rounded-full" : "rounded-2xl"} border bg-white px-2.5 py-1`}>
                      {isPremium ? "Atendimento consultivo" : "Contato rapido"}
                    </span>
                  </div>
                  <div className={`flex items-end justify-between gap-3 ${isPremium ? "mt-6" : "mt-4"}`}>
                    <div className="text-lg font-semibold" style={{ color: "var(--site-primary)" }}>
                      {formatMoneyBRL(p.price)}
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">
                      {isPremium ? "Ver detalhes" : "Abrir imovel"}
                    </div>
                  </div>
                  <div className={`mt-4 border-t pt-4 text-xs text-muted-foreground ${isPremium ? "border-muted/70" : "border-muted/60"}`}>
                    {isPremium
                      ? "Veja imagens, contexto do imovel e solicite atendimento personalizado."
                      : "Abra o imovel e envie seu interesse direto para a equipe."}
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
          <div className={`border bg-white/85 p-5 shadow-sm ${isPremium ? "rounded-[2rem]" : "rounded-3xl"}`}>
            <div className="grid gap-3 md:grid-cols-2">
              {links.slice(0, 6).map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`border bg-white px-4 py-3 transition-colors hover:bg-muted/30 ${isPremium ? "rounded-3xl" : "rounded-2xl"}`}
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
