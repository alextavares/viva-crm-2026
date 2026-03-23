import type { SiteTheme } from "@/lib/site"
import { PUBLIC_SITE_TEMPLATES } from "@/lib/public-site/templates"

export function resolvePreviewThemeFromParam(value: string | string[] | undefined | null): SiteTheme | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return null
  const normalized = raw.trim()
  if (!normalized) return null

  const isValid = PUBLIC_SITE_TEMPLATES.some((template) => template.id === normalized)
  return isValid ? (normalized as SiteTheme) : null
}

export function appendPreviewTheme(href: string, previewTheme: SiteTheme | null) {
  if (!previewTheme) return href

  const [withoutHash, hashPart] = href.split("#", 2)
  const [pathPart, queryPart] = withoutHash.split("?", 2)
  const params = new URLSearchParams(queryPart ?? "")
  params.set("preview_theme", previewTheme)
  const query = params.toString()
  return `${pathPart}${query ? `?${query}` : ""}${hashPart ? `#${hashPart}` : ""}`
}
