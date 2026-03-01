import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Script from "next/script"
import { PopupBanner, TopbarBanner } from "@/components/public/site-banners"
import { WhatsAppFab } from "@/components/marketing/whatsapp-fab"
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon"
import { WhatsAppWave } from "@/components/ui/whatsapp-wave"
import { withBase, ogImages, truncate } from "@/lib/public-site/seo"
import { getPublicSite } from "@/lib/public-site/site-data"
import { getRequestHost, isPreviewHost, publicBasePath } from "@/lib/public-site/host"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"

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
  const images = ogImages(
    resolveMediaPathUrl("site-assets", site.settings?.logo_path) ?? resolveMediaUrl(site.settings?.logo_url)
  )
  const googleSiteVerification = site.settings?.google_site_verification?.trim() || undefined
  const facebookDomainVerification = site.settings?.facebook_domain_verification?.trim() || undefined

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
    verification: !isPreview
      ? {
          google: googleSiteVerification,
          other: facebookDomainVerification
            ? { "facebook-domain-verification": facebookDomainVerification }
            : undefined,
        }
      : undefined,
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
  const ga4MeasurementId = site.settings?.ga4_measurement_id?.trim() || null
  const metaPixelId = site.settings?.meta_pixel_id?.trim() || null
  const googleAdsConversionId = site.settings?.google_ads_conversion_id?.trim() || null
  const googleAdsConversionLabel = site.settings?.google_ads_conversion_label?.trim() || null
  const gtagBootstrapId = ga4MeasurementId || googleAdsConversionId
  const host = await getRequestHost()
  const isPreview = isPreviewHost(host)
  const base = publicBasePath(site.slug, host)
  const homeHref = base || "/"
  const isPremium = site.settings?.theme === "premium"

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
      {!isPreview && gtagBootstrapId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gtagBootstrapId)}`}
            strategy="afterInteractive"
          />
          <Script
            id="viva-gtag-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = window.gtag || gtag;
                gtag('js', new Date());
                ${
                  ga4MeasurementId
                    ? `gtag('config', ${JSON.stringify(ga4MeasurementId)}, { anonymize_ip: true });`
                    : ""
                }
                ${
                  googleAdsConversionId
                    ? `gtag('config', ${JSON.stringify(googleAdsConversionId)});`
                    : ""
                }
                window.__vivaTracking = Object.assign({}, window.__vivaTracking || {}, {
                  googleAdsConversionId: ${JSON.stringify(googleAdsConversionId)},
                  googleAdsConversionLabel: ${JSON.stringify(googleAdsConversionLabel)}
                });
              `,
            }}
          />
        </>
      ) : null}
      {!isPreview && metaPixelId ? (
        <Script
          id="viva-meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s){
                if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)
              }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', ${JSON.stringify(metaPixelId)});
              fbq('track', 'PageView');
            `,
          }}
        />
      ) : null}

      {topbar ? <TopbarBanner banner={topbar} /> : null}
      {popup ? <PopupBanner banner={popup} /> : null}

      <header className={`sticky top-0 z-30 border-b backdrop-blur ${isPremium ? "bg-white/90" : "bg-white/80"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href={homeHref} className="flex items-center gap-2">
            <span
              className={`inline-flex h-9 w-9 items-center justify-center text-white ${isPremium ? "rounded-2xl" : "rounded-xl"}`}
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

          <nav className={`hidden items-center gap-5 text-sm md:flex ${isPremium ? "text-foreground/70" : "text-muted-foreground"}`}>
            <Link href={homeHref} className="hover:text-foreground">
              Imóveis
            </Link>
            <Link href={`${homeHref === "/" ? "" : homeHref}/noticias`} className="hover:text-foreground">
              Notícias
            </Link>
            <Link href={`${homeHref === "/" ? "" : homeHref}/links`} className="hover:text-foreground">
              Links
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
                className="wa-wave-btn wa-btn-cta wa-btn-whatsapp wa-btn-icon"
                style={
                  {
                    ["--wa-wave-color" as string]: "#25d366",
                  } as React.CSSProperties
                }
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                aria-label="Falar no WhatsApp"
                title="Falar no WhatsApp"
              >
                <WhatsAppWave />
                <span className="wa-btn-icon-core relative z-10">
                  <WhatsAppIcon className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                </span>
              </a>
            ) : null}
            <Link
              className={`${isPremium ? "rounded-2xl bg-white shadow-sm" : "rounded-xl"} border px-3 py-2 text-sm font-medium`}
              href={`${homeHref}#buscar`}
            >
              {isPremium ? "Explorar" : "Buscar"}
            </Link>
          </div>
        </div>
      </header>

      {children}

      {whatsapp ? (
        <WhatsAppFab
          phoneE164={whatsapp}
          text={`Olá! Vim pelo site da ${brandName} e quero falar sobre um imóvel.`}
        />
      ) : null}

      <footer className={`border-t ${isPremium ? "bg-white/85" : "bg-white/70"}`}>
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className={`grid gap-6 ${isPremium ? "md:grid-cols-[1.2fr_0.8fr]" : "md:grid-cols-[1fr_auto]"}`}>
            <div>
              <div className="text-sm font-medium">{brandName}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {isPremium
                  ? "Curadoria imobiliária com apresentação profissional e atendimento consultivo."
                  : "Busca rápida, lead direto no CRM e atendimento humano via WhatsApp."}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Contato</div>
              <div className="mt-2 text-sm text-muted-foreground">
                {whatsapp ? `WhatsApp: ${whatsapp}` : "WhatsApp não configurado."}
              </div>
            </div>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {brandName}. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  )
}
