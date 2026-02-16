import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { PopupBanner, TopbarBanner } from "@/components/public/site-banners"
import { withBase, ogImages, truncate } from "@/lib/public-site/seo"
import { getPublicSite } from "@/lib/public-site/site-data"
import { getRequestHost, isPreviewHost, publicBasePath } from "@/lib/public-site/host"

export const dynamic = "force-dynamic"

function digitsOnly(s: string) {
  return s.replace(/[^0-9]/g, "")
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const site = await getPublicSite(slug)
  if (!site) return withBase({ title: "Site não encontrado" })

  const host = await getRequestHost()
  const isPreview = isPreviewHost(host)

  const brandName = site.settings?.brand_name || site.slug
  const description = truncate(`Imóveis e contato de ${brandName}. Atendimento rápido e humano via WhatsApp.`)
  const images = ogImages(site.settings?.logo_url)

  return withBase({
    title: {
      default: brandName,
      template: `%s | ${brandName}`,
    },
    description,
    robots: isPreview ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      siteName: brandName,
      title: brandName,
      description,
      images,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title: brandName,
      description,
      images,
    },
  })
}

export default async function PublicSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const site = await getPublicSite(slug)
  if (!site) notFound()

  const brandName = site.settings?.brand_name || site.slug
  const primary = site.settings?.primary_color || "#0f172a"
  const secondary = site.settings?.secondary_color || "#14b8a6"
  const whatsapp = site.settings?.whatsapp ? digitsOnly(site.settings.whatsapp) : null
  const host = await getRequestHost()
  const isPreview = isPreviewHost(host)
  const base = publicBasePath(site.slug, host)
  const homeHref = base || "/"

  const topbar = site.banners.find((b) => b.placement === "topbar") ?? null
  const popup = site.banners.find((b) => b.placement === "popup") ?? null

  return (
    <div
      style={
        {
          ["--site-primary" as string]: primary,
          ["--site-secondary" as string]: secondary,
        } as React.CSSProperties
      }
      className="min-h-screen bg-[radial-gradient(1100px_550px_at_10%_-10%,color-mix(in_oklch,var(--site-secondary)_25%,transparent)_0%,transparent_60%),radial-gradient(900px_500px_at_110%_10%,color-mix(in_oklch,var(--site-primary)_18%,transparent)_0%,transparent_55%)]"
    >
      {topbar ? <TopbarBanner banner={topbar} /> : null}
      {popup ? <PopupBanner banner={popup} /> : null}

      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href={homeHref} className="flex items-center gap-2">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: "var(--site-primary)" }}
              aria-hidden
            >
              {brandName.slice(0, 1).toUpperCase()}
            </span>
            <span className="font-semibold tracking-tight">{brandName}</span>
            {isPreview ? (
              <span className="rounded-full border bg-white/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Preview
              </span>
            ) : null}
          </Link>

          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <Link href={homeHref} className="hover:text-foreground">
              Imóveis
            </Link>
            <Link href={`${homeHref === "/" ? "" : homeHref}/about`} className="hover:text-foreground">
              Sobre
            </Link>
            <Link href={`${homeHref === "/" ? "" : homeHref}/contact`} className="hover:text-foreground">
              Contato
            </Link>
            <Link href={`${homeHref === "/" ? "" : homeHref}/lgpd`} className="hover:text-foreground">
              LGPD
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {whatsapp ? (
              <a
                className="rounded-xl px-3 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: "var(--site-secondary)" }}
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            ) : null}
            <Link
              className="rounded-xl border px-3 py-2 text-sm font-medium"
              href={`${homeHref}#buscar`}
            >
              Buscar
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t bg-white/70">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="text-sm font-medium">{brandName}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {whatsapp ? `WhatsApp: ${whatsapp}` : "WhatsApp não configurado."}
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {brandName}. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
