import type { ReactNode } from "react"
import { getPublicThemeFlags } from "@/lib/public-site/theme"
import type { SiteTheme } from "@/lib/site"

type PublicPageShellProps = {
  children: ReactNode
  maxWidthClass?: string
}

export function PublicPageShell({ children, maxWidthClass = "max-w-6xl" }: PublicPageShellProps) {
  return <main className={`mx-auto ${maxWidthClass} px-4 py-10`}>{children}</main>
}

export function getPublicPanelClass(theme?: SiteTheme | null) {
  const { isPremium, isCompact } = getPublicThemeFlags(theme)

  return `border bg-white/85 shadow-sm ${
    isPremium ? "rounded-[2rem] p-8 md:p-10" : isCompact ? "rounded-3xl p-5 md:p-6" : "rounded-3xl p-8"
  }`
}

export function getPublicCardClass(theme?: SiteTheme | null) {
  const { isPremium } = getPublicThemeFlags(theme)
  return `border bg-white p-5 ${isPremium ? "rounded-3xl" : "rounded-2xl"}`
}

export function getPublicHeadingClass(theme?: SiteTheme | null) {
  const { isPremium } = getPublicThemeFlags(theme)
  return isPremium ? "text-4xl font-serif" : "text-3xl font-semibold"
}
