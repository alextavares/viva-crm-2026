import Link from "next/link"
import type { ReactNode } from "react"
import { getPublicThemeFlags } from "@/lib/public-site/theme"
import type { SiteTheme } from "@/lib/site"

type PublicSectionHeaderProps = {
  title: string
  actionHref?: string
  actionLabel?: string
  eyebrow?: string
  description?: string
  theme?: SiteTheme | null
}

export function PublicSectionHeader({
  title,
  actionHref,
  actionLabel,
  eyebrow,
  description,
  theme,
}: PublicSectionHeaderProps) {
  const { isPremium } = getPublicThemeFlags(theme)

  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h2 className={`${eyebrow ? "mt-1" : ""} ${isPremium ? "text-2xl font-serif" : "text-2xl font-semibold"}`}>
          {title}
        </h2>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}

type PublicSurfacePanelProps = {
  children: ReactNode
  theme?: SiteTheme | null
  className?: string
}

export function PublicSurfacePanel({
  children,
  theme,
  className = "p-5",
}: PublicSurfacePanelProps) {
  const { isPremium } = getPublicThemeFlags(theme)

  return (
    <div className={`border bg-white/85 shadow-sm ${isPremium ? "rounded-[2rem]" : "rounded-3xl"} ${className}`}>
      {children}
    </div>
  )
}

type PublicQuickBenefitsPanelProps = {
  items: string[]
  theme?: SiteTheme | null
}

export function PublicQuickBenefitsPanel({
  items,
  theme,
}: PublicQuickBenefitsPanelProps) {
  return (
    <PublicSurfacePanel theme={theme} className="p-6">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="rounded-2xl border bg-muted/10 p-4 text-sm font-medium">
            {item}
          </div>
        ))}
      </div>
    </PublicSurfacePanel>
  )
}

type PublicShortcutPanelProps = {
  items: { href: string; label: string }[]
  hidden?: boolean
  theme?: SiteTheme | null
}

export function PublicShortcutPanel({
  items,
  hidden = false,
  theme,
}: PublicShortcutPanelProps) {
  return (
    <PublicSurfacePanel theme={theme} className={`p-6 ${hidden ? "hidden" : ""}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Atalhos</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {items.map((item) => (
          <Link
            key={`${item.href}-${item.label}`}
            href={item.href}
            className="rounded-2xl border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/30"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </PublicSurfacePanel>
  )
}

type PublicEmptyStateProps = {
  message: string
  theme?: SiteTheme | null
  className?: string
}

export function PublicEmptyState({
  message,
  theme,
  className = "mt-10 p-8 text-sm text-muted-foreground",
}: PublicEmptyStateProps) {
  return (
    <PublicSurfacePanel theme={theme} className={className}>
      {message}
    </PublicSurfacePanel>
  )
}

type PublicPaginationControlsProps = {
  prevHref: string
  nextHref: string
  disablePrev?: boolean
}

export function PublicPaginationControls({
  prevHref,
  nextHref,
  disablePrev = false,
}: PublicPaginationControlsProps) {
  return (
    <div className="mb-5 flex items-center gap-2">
      <Link
        href={prevHref}
        className={`rounded-xl border px-3 py-2 text-sm font-medium ${disablePrev ? "pointer-events-none opacity-50" : ""}`}
      >
        Anterior
      </Link>
      <Link className="rounded-xl border px-3 py-2 text-sm font-medium" href={nextHref}>
        Próxima
      </Link>
    </div>
  )
}
