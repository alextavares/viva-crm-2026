import { headers } from "next/headers"

export function normalizeHost(v: string) {
  const host = v.trim().toLowerCase()
  const noPort = host.split(":")[0]
  return noPort.replace(/\.$/, "")
}

export async function getRequestHost() {
  const h = await headers()
  const forwarded = h.get("x-forwarded-host")
  const host = h.get("host")
  return normalizeHost(forwarded || host || "")
}

export function isPreviewHost(host: string) {
  if (!host) return false
  const lower = normalizeHost(host)

  // Local/dev friendly preview using lvh.me (resolves to 127.0.0.1).
  if (lower.endsWith(".lvh.me") || lower.endsWith(".localhost")) return true

  // Production preview host: <slug>.<preview_base>
  const previewBase = normalizeHost(process.env.SITES_PREVIEW_BASE || process.env.SITES_CNAME_TARGET || "")
  if (previewBase && lower.endsWith(`.${previewBase}`)) return true

  return false
}

export function isAppHost(host: string) {
  const h = normalizeHost(host)
  if (!h) return true
  const appPrimary = normalizeHost(process.env.APP_PRIMARY_DOMAIN || "vivacrm.com.br")
  const appAlt = normalizeHost(process.env.APP_ALT_DOMAIN || `www.${appPrimary}`)
  return h === "localhost" || h === "127.0.0.1" || h === appPrimary || h === appAlt || h.endsWith(".vercel.app")
}

export function publicBasePath(siteSlug: string, host: string) {
  // For custom domains and preview hosts we serve clean URLs (no /s/<slug> in the browser).
  // For app-hosted sites we keep the /s/<slug> prefix.
  return isAppHost(host) ? `/s/${siteSlug}` : ""
}

