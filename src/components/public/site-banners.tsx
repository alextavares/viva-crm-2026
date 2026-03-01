import type { SitePublicBanner } from "@/lib/site"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"

export function TopbarBanner({ banner }: { banner: SitePublicBanner }) {
  const href = banner.link_url || null
  const imageSrc =
    resolveMediaPathUrl("site-assets", banner.image_path) ??
    resolveMediaUrl(banner.image_url) ??
    banner.image_url

  const content = (
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
      <div className="flex items-center gap-3 text-sm">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-black/10"
          />
        ) : null}
        <span className="font-medium">{banner.title || "Aviso"}</span>
        {banner.body ? <span className="ml-2 text-muted-foreground">{banner.body}</span> : null}
      </div>
      {href ? (
        <a className="text-sm font-medium underline underline-offset-4" href={href} target="_blank" rel="noreferrer">
          Ver
        </a>
      ) : null}
    </div>
  )

  return (
    <div
      className="border-b bg-white/70 backdrop-blur"
      style={{ borderColor: "color-mix(in oklch, var(--site-primary) 20%, transparent)" }}
    >
      {content}
    </div>
  )
}

export function HeroBanner({ banner }: { banner: SitePublicBanner }) {
  const imageSrc =
    resolveMediaPathUrl("site-assets", banner.image_path) ??
    resolveMediaUrl(banner.image_url) ??
    banner.image_url
  const isHighlight = banner.variant === "destaque"

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border bg-white/80 shadow-sm">
      <div
        className={`grid gap-0 md:items-center ${isHighlight ? "md:grid-cols-[1fr_1fr]" : "md:grid-cols-[0.95fr_1.05fr]"}`}
      >
        <div className={`${isHighlight ? "p-7 md:p-9" : "p-6 md:flex md:flex-col md:justify-center md:p-7"}`}>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Destaque
          </p>
          <h2 className={`mt-3 font-semibold leading-tight ${isHighlight ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"}`}>
            {banner.title || "Banner principal"}
          </h2>
          {banner.body ? (
            <p className="mt-3 max-w-prose text-muted-foreground">{banner.body}</p>
          ) : null}
          {banner.link_url ? (
            <a
              href={banner.link_url}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex rounded-2xl px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--site-primary)" }}
            >
              Saiba mais
            </a>
          ) : null}
        </div>
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt={banner.title || "Banner"}
            className={`w-full object-cover ${isHighlight ? "h-60 md:h-80" : "h-52 md:h-60"}`}
          />
        ) : (
          <div
            className={isHighlight ? "h-60 md:h-80" : "h-52 md:h-60"}
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklch, var(--site-primary) 24%, transparent), color-mix(in oklch, var(--site-secondary) 24%, transparent))",
            }}
          />
        )}
      </div>
    </section>
  )
}
