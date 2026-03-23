import type { SiteTheme } from "@/lib/site"

export function getPublicThemeFlags(theme?: SiteTheme | null) {
  const resolvedTheme: SiteTheme = theme ?? "search_first"

  return {
    theme: resolvedTheme,
    isPremium: resolvedTheme === "premium",
    isTrustFirst: resolvedTheme === "trust_first",
    isCompact: resolvedTheme === "compact_mobile",
    isSearchHighlights: resolvedTheme === "search_highlights",
  }
}
