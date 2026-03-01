import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SiteLeadForm } from "@/components/public/site-lead-form"
import { getPublicProperty, getPublicSite } from "@/lib/public-site/site-data"
import { ogImages, truncate, withBase } from "@/lib/public-site/seo"
import { getRequestHost, publicBasePath } from "@/lib/public-site/host"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"

function formatMoneyBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0)
}

function pickFeatureNumber(v: unknown) {
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

export default async function PublicPropertyPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params

  const [prop, site] = await Promise.all([
    getPublicProperty(slug, id),
    getPublicSite(slug),
  ])

  if (!prop || !site) notFound()

  const host = await getRequestHost()
  const base = publicBasePath(site.slug, host)
  const homeHref = base || "/"

  const features = prop.features ?? {}
  const bedrooms = pickFeatureNumber((features as Record<string, unknown>).bedrooms)
  const bathrooms = pickFeatureNumber((features as Record<string, unknown>).bathrooms)
  const area = pickFeatureNumber((features as Record<string, unknown>).area)
  const primaryImageUrl = prop.images?.[0] ?? null
  const primaryImagePath = prop.image_paths?.[0] ?? null
  const galleryItems = (prop.images ?? prop.image_paths ?? []).slice(0, 5)
  const isPremium = site.settings?.theme === "premium"

  const addressLine =
    prop.address?.neighborhood || prop.address?.city || prop.address?.state
      ? `${prop.address?.neighborhood || ""}${prop.address?.city ? ` - ${prop.address.city}` : ""}${prop.address?.state ? ` / ${prop.address.state}` : ""}`
      : "Localização a informar"

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <Link className="hover:text-foreground" href={homeHref}>
            Imóveis
          </Link>{" "}
          <span aria-hidden>/</span>{" "}
          <span className="text-foreground">{prop.title}</span>
        </div>
      </div>

      <section className={`mt-6 grid gap-6 ${isPremium ? "lg:grid-cols-[1.28fr_0.72fr]" : "lg:grid-cols-[1.2fr_0.8fr]"}`}>
        <div className={`overflow-hidden border bg-white/85 shadow-sm ${isPremium ? "rounded-[2rem]" : "rounded-3xl"}`}>
          <div className={`bg-muted ${isPremium ? "aspect-[16/9]" : "aspect-[16/10]"}`}>
            {(prop.images?.[0] || prop.image_paths?.[0]) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  resolveMediaPathUrl("properties", primaryImagePath) ??
                  resolveMediaUrl(primaryImageUrl) ??
                  primaryImageUrl ??
                  ""
                }
                alt={prop.title}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          {((prop.images && prop.images.length > 1) || (prop.image_paths && prop.image_paths.length > 1)) ? (
            <div className={`grid grid-cols-5 gap-2 ${isPremium ? "p-4" : "p-3"}`}>
              {galleryItems.map((src, index) => (
                <div key={`${src}-${index}`} className={`aspect-square overflow-hidden bg-muted ${isPremium ? "rounded-2xl" : "rounded-xl"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveMediaPathUrl("properties", prop.image_paths?.[index]) ?? resolveMediaUrl(src) ?? src}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <aside className={`border bg-white/85 shadow-sm ${isPremium ? "rounded-[2rem] p-8" : "rounded-3xl p-6"}`}>
          <div className={isPremium ? "text-3xl font-serif leading-tight" : "text-2xl font-semibold leading-tight"}>{prop.title}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Ref: {prop.public_code || prop.id.slice(0, 8)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{addressLine}</div>
          <div className="mt-5 text-3xl font-semibold" style={{ color: "var(--site-primary)" }}>
            {formatMoneyBRL(prop.price)}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <div className={`${isPremium ? "rounded-3xl" : "rounded-2xl"} border bg-white px-3 py-2`}>
              <div className="text-xs text-muted-foreground">Quartos</div>
              <div className="font-medium">{bedrooms ?? "-"}</div>
            </div>
            <div className={`${isPremium ? "rounded-3xl" : "rounded-2xl"} border bg-white px-3 py-2`}>
              <div className="text-xs text-muted-foreground">Banheiros</div>
              <div className="font-medium">{bathrooms ?? "-"}</div>
            </div>
            <div className={`${isPremium ? "rounded-3xl" : "rounded-2xl"} border bg-white px-3 py-2`}>
              <div className="text-xs text-muted-foreground">Área</div>
              <div className="font-medium">{area != null ? `${area} m²` : "-"}</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-medium">{isPremium ? "Solicite atendimento" : "Pedir informações"}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              {isPremium
                ? "Seu contato entra no CRM e a equipe retorna com atendimento consultivo pelo WhatsApp."
                : "Seu contato vai para a inbox e o atendimento responde pelo WhatsApp."}
            </div>
            <div className="mt-4">
              <SiteLeadForm siteSlug={site.slug} propertyId={prop.id} propertyTitle={prop.title} />
            </div>
          </div>
        </aside>
      </section>

      <section className={`mt-8 border bg-white/85 shadow-sm ${isPremium ? "rounded-[2rem] p-8" : "rounded-3xl p-7"}`}>
        <h2 className="text-lg font-semibold">Descrição</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {prop.description || "Descrição não informada."}
        </p>
      </section>
    </main>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}): Promise<Metadata> {
  const { slug, id } = await params
  const [prop, site] = await Promise.all([
    getPublicProperty(slug, id),
    getPublicSite(slug),
  ])

  if (!prop || !site) return withBase({ title: "Imóvel não encontrado" })

  const brandName = site.settings?.brand_name || site.slug
  const price = prop.price != null ? formatMoneyBRL(prop.price) : "Preço sob consulta"
  const where =
    prop.address?.city || prop.address?.state
      ? `${prop.address?.city || ""}${prop.address?.state ? ` / ${prop.address.state}` : ""}`.trim()
      : null

  const title = prop.title
  const description = truncate(
    `${title}. ${price}${where ? ` · ${where}` : ""}. Atendimento: ${brandName}.`
  )

  const images = ogImages(
    resolveMediaPathUrl("properties", prop.image_paths?.[0]) ?? resolveMediaUrl(prop.images?.[0]),
    resolveMediaPathUrl("site-assets", site.settings?.logo_path) ?? resolveMediaUrl(site.settings?.logo_url)
  )

  return withBase({
    title: `Imóvel: ${title}`,
    description,
    alternates: { canonical: `/s/${site.slug}/imovel/${prop.id}` },
    openGraph: {
      title,
      description,
      url: `/s/${site.slug}/imovel/${prop.id}`,
      images,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
  })
}
