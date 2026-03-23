import Link from "next/link"
import { getPublicCardClass } from "@/components/public/public-page-shell"
import { getPublicThemeFlags } from "@/lib/public-site/theme"
import type { SitePublicLink, SitePublicNewsCard, SiteTheme } from "@/lib/site"

function formatDatePt(v: string | null | undefined) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(d)
}

type PublicNewsCardLinkProps = {
  item: SitePublicNewsCard
  href: string
  theme?: SiteTheme | null
  compactCopy?: string
  variant?: "default" | "home"
}

export function PublicNewsCardLink({
  item,
  href,
  theme,
  compactCopy = "Leia o conteúdo completo desta notícia.",
  variant = "default",
}: PublicNewsCardLinkProps) {
  const cardClassName =
    variant === "home"
      ? "rounded-3xl border bg-white/85 p-5 shadow-sm transition-shadow hover:shadow-md"
      : `${getPublicCardClass(theme)} transition-shadow hover:shadow-sm`

  return (
    <Link href={href} className={cardClassName}>
      <div className="text-xs text-muted-foreground">
        {formatDatePt(item.published_at || item.created_at) || "Publicação recente"}
      </div>
      <div className="mt-2 line-clamp-2 text-base font-semibold">{item.title}</div>
      <div className="mt-2 line-clamp-3 text-sm text-muted-foreground">
        {item.excerpt || compactCopy}
      </div>
    </Link>
  )
}

type PublicLinkCardProps = {
  item: SitePublicLink
  theme?: SiteTheme | null
  showUrl?: boolean
  variant?: "default" | "compact"
}

export function PublicLinkCard({
  item,
  theme,
  showUrl = true,
  variant = "default",
}: PublicLinkCardProps) {
  const { isPremium } = getPublicThemeFlags(theme)
  const cardClassName =
    variant === "compact"
      ? `border bg-white px-4 py-3 transition-colors hover:bg-muted/30 ${isPremium ? "rounded-3xl" : "rounded-2xl"}`
      : `${getPublicCardClass(theme)} transition-shadow hover:shadow-sm`

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className={cardClassName}
    >
      <div className={variant === "compact" ? "text-sm font-medium" : "text-base font-semibold"}>{item.title}</div>
      {item.description ? (
        <div className={variant === "compact" ? "mt-1 line-clamp-2 text-xs text-muted-foreground" : "mt-2 text-sm text-muted-foreground"}>
          {item.description}
        </div>
      ) : null}
      {showUrl ? <div className="mt-3 text-xs text-muted-foreground">{item.url}</div> : null}
    </a>
  )
}
