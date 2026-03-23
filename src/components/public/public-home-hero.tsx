import Link from "next/link"
import type { ReactNode } from "react"
import { PublicSurfacePanel } from "@/components/public/public-section-blocks"
import type { SiteTheme } from "@/lib/site"

type PublicHomeHeroProps = {
  theme?: SiteTheme | null
  brandName: string
  homeHref: string
  heroHeading: ReactNode
  heroDescription: string
  searchTitle: string
  children: ReactNode
}

export function PublicHomeHero({
  theme,
  brandName,
  homeHref,
  heroHeading,
  heroDescription,
  searchTitle,
  children,
}: PublicHomeHeroProps) {
  const isPremium = theme === "premium"
  const isTrustFirst = theme === "trust_first"
  const isCompact = theme === "compact_mobile"

  return (
    <section
      className={`grid gap-6 ${
        isPremium ? "lg:grid-cols-[1.2fr_0.8fr]" : isCompact ? "lg:grid-cols-[1fr]" : "lg:grid-cols-[1.1fr_0.9fr]"
      }`}
    >
      <PublicSurfacePanel
        theme={theme}
        className={isPremium ? "p-8 md:p-10" : isCompact ? "p-5 md:p-6" : "p-7"}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {isPremium ? "Curadoria imobiliária" : isTrustFirst ? "Imobiliária de confiança" : brandName}
        </p>
        <h1
          className={`mt-3 leading-tight ${
            isPremium
              ? "max-w-xl text-4xl font-serif md:text-5xl"
              : isCompact
                ? "text-3xl font-semibold md:text-4xl"
                : "text-4xl font-semibold"
          }`}
        >
          {heroHeading}
        </h1>
        <p className="mt-3 max-w-prose text-muted-foreground">{heroDescription}</p>
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
            {isPremium ? "Fale com um especialista" : isTrustFirst ? "Quero atendimento" : "Contato"}
          </Link>
        </div>
      </PublicSurfacePanel>

      <div id="buscar">
        <PublicSurfacePanel
          theme={theme}
          className={isPremium ? "p-8" : isCompact ? "p-5 md:p-6" : "p-7"}
        >
          <div className="text-sm font-medium">{searchTitle}</div>
          {children}
        </PublicSurfacePanel>
      </div>
    </section>
  )
}
