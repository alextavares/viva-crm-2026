import Link from "next/link"
import { PublicPropertyCard } from "@/components/public/public-property-card"
import { PublicSectionHeader, PublicSurfacePanel } from "@/components/public/public-section-blocks"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"
import type { SitePropertyCard } from "@/lib/site"

type PublicPremiumShowcaseProps = {
  homeHref: string
  featuredSelection: SitePropertyCard[]
}

function formatMoneyBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0)
}

export function PublicPremiumShowcase({
  homeHref,
  featuredSelection,
}: PublicPremiumShowcaseProps) {
  const featuredHero = featuredSelection[0] ?? null

  return (
    <>
      <section className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <PublicSurfacePanel theme="premium" className="p-8">
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
        </PublicSurfacePanel>

        <PublicSurfacePanel theme="premium" className="p-8">
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
        </PublicSurfacePanel>
      </section>

      {featuredHero ? (
        <section className="mt-10">
          <PublicSectionHeader
            title="Selecao da semana"
            actionHref="#buscar"
            actionLabel="Refinar busca"
            theme="premium"
          />
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Link
              href={`${homeHref === "/" ? "" : homeHref}/imovel/${featuredHero.id}`}
              className="group overflow-hidden rounded-[2rem] border bg-white/85 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="aspect-[16/9] bg-muted">
                {(() => {
                  const heroSrc =
                    resolveMediaPathUrl("properties", featuredHero.thumbnail_path) ??
                    resolveMediaUrl(featuredHero.thumbnail_url) ??
                    featuredHero.thumbnail_url ??
                    undefined
                  return heroSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={heroSrc}
                      alt={featuredHero.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : null
                })()}
              </div>
              <div className="p-6">
                <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Destaque Premium
                </div>
                <div className="mt-2 text-2xl font-serif">{featuredHero.title}</div>
                <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {featuredHero.neighborhood || featuredHero.city
                    ? `${featuredHero.neighborhood || ""}${featuredHero.city ? ` - ${featuredHero.city}` : ""}`
                    : "Localizacao a informar"}
                </div>
                <div className="mt-5 text-xl font-semibold" style={{ color: "var(--site-primary)" }}>
                  {formatMoneyBRL(featuredHero.price)}
                </div>
              </div>
            </Link>

            <div className="grid gap-4">
              {featuredSelection.slice(1).map((property) => (
                <PublicPropertyCard
                  key={property.id}
                  property={property}
                  href={`${homeHref === "/" ? "" : homeHref}/imovel/${property.id}`}
                  theme="premium"
                  variant="side"
                />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
