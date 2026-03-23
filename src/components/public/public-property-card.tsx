import Link from "next/link"
import { getPublicThemeFlags } from "@/lib/public-site/theme"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"
import type { SitePropertyCard, SiteTheme } from "@/lib/site"

type PublicPropertyCardProps = {
  property: SitePropertyCard
  href: string
  theme?: SiteTheme | null
  variant?: "default" | "side" | "highlight"
}

function formatMoneyBRL(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0)
}

function publicTypeLabel(type: string | null | undefined) {
  if (!type) return "Tipo a informar"
  if (type === "apartment") return "Apartamento"
  if (type === "house") return "Casa"
  if (type === "condominium_house") return "Casa em condomínio"
  if (type === "land") return "Terreno"
  if (type === "commercial") return "Comercial"
  if (type === "commercial_space") return "Salão comercial"
  return type
}

function propertyLocationLabel(property: SitePropertyCard) {
  if (property.neighborhood || property.city) {
    return `${property.neighborhood || ""}${property.city ? ` - ${property.city}` : ""}`
  }

  return "Localização a informar"
}

export function PublicPropertyCard({
  property,
  href,
  theme,
  variant = "default",
}: PublicPropertyCardProps) {
  const { isPremium, isTrustFirst, isCompact, isSearchHighlights } = getPublicThemeFlags(theme)
  const thumbnailSrc =
    resolveMediaPathUrl("properties", property.thumbnail_path) ??
    resolveMediaUrl(property.thumbnail_url) ??
    property.thumbnail_url ??
    undefined

  if (variant === "side") {
    return (
      <Link
        href={href}
        className="group overflow-hidden rounded-[2rem] border bg-white/85 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="grid md:grid-cols-[0.46fr_0.54fr]">
          <div className="aspect-[4/3] bg-muted">
            {thumbnailSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailSrc}
                alt={property.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : null}
          </div>
          <div className="p-5">
            <div className="line-clamp-2 text-base font-semibold">{property.title}</div>
            <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {propertyLocationLabel(property)}
            </div>
            <div className="mt-4 text-lg font-semibold" style={{ color: "var(--site-primary)" }}>
              {formatMoneyBRL(property.price)}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  if (variant === "highlight") {
    return (
      <Link
        href={href}
        className="overflow-hidden rounded-3xl border bg-white/85 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="aspect-[4/3] bg-muted">
          {thumbnailSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailSrc} alt={property.title} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="p-5">
          <div className="line-clamp-2 text-base font-semibold">{property.title}</div>
          <div className="mt-2 text-xs text-muted-foreground line-clamp-1">
            {property.neighborhood || property.city || "Localização a informar"}
          </div>
          <div className="mt-4 text-lg font-semibold" style={{ color: "var(--site-primary)" }}>
            {formatMoneyBRL(property.price)}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link
      href={href}
      className={`group overflow-hidden border bg-white/85 shadow-sm transition-shadow hover:shadow-md ${
        isPremium ? "rounded-[2rem]" : "rounded-3xl"
      }`}
    >
      {isCompact ? (
        <div className="grid sm:grid-cols-[0.42fr_0.58fr]">
          <div className="aspect-[4/3] bg-muted sm:h-full">
            {thumbnailSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailSrc}
                alt={property.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : null}
          </div>
          <div className="p-4">
            <div className="line-clamp-2 text-sm font-semibold">{property.title}</div>
            <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {propertyLocationLabel(property)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Ref: {property.public_code || property.id.slice(0, 8)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="rounded-2xl border bg-white px-2.5 py-1">{publicTypeLabel(property.type)}</span>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="text-base font-semibold" style={{ color: "var(--site-primary)" }}>
                {formatMoneyBRL(property.price)}
              </div>
              <div className="text-[11px] font-medium text-muted-foreground">Abrir</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={`bg-muted ${isPremium ? "aspect-[16/10]" : isSearchHighlights ? "aspect-[5/4]" : "aspect-[4/3]"}`}>
            {thumbnailSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailSrc}
                alt={property.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : null}
          </div>
          <div className={isPremium ? "p-6" : "p-5"}>
            <div className={`line-clamp-1 ${isPremium ? "text-lg font-semibold" : "text-sm font-medium"}`}>
              {property.title}
            </div>
            <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {propertyLocationLabel(property)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Ref: {property.public_code || property.id.slice(0, 8)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className={`${isPremium ? "rounded-full" : "rounded-2xl"} border bg-white px-2.5 py-1`}>
                {publicTypeLabel(property.type)}
              </span>
              <span className={`${isPremium ? "rounded-full" : "rounded-2xl"} border bg-white px-2.5 py-1`}>
                {isPremium
                  ? "Atendimento consultivo"
                  : isTrustFirst
                    ? "Atendimento guiado"
                    : isSearchHighlights
                      ? "Mais destaque"
                      : "Contato rapido"}
              </span>
            </div>
            <div className={`flex items-end justify-between gap-3 ${isPremium ? "mt-6" : "mt-4"}`}>
              <div className="text-lg font-semibold" style={{ color: "var(--site-primary)" }}>
                {formatMoneyBRL(property.price)}
              </div>
              <div className="text-xs font-medium text-muted-foreground">
                {isPremium ? "Ver detalhes" : isSearchHighlights ? "Ver oferta" : "Abrir imovel"}
              </div>
            </div>
            <div className={`mt-4 border-t pt-4 text-xs text-muted-foreground ${isPremium ? "border-muted/70" : "border-muted/60"}`}>
              {isPremium
                ? "Veja imagens, contexto do imovel e solicite atendimento personalizado."
                : isTrustFirst
                  ? "Abra o imóvel, entenda o contexto e fale com a equipe para orientação."
                  : isSearchHighlights
                    ? "Acesse a oferta, compare e envie interesse direto para o time."
                    : "Abra o imovel e envie seu interesse direto para a equipe."}
            </div>
          </div>
        </>
      )}
    </Link>
  )
}
