import type { Metadata } from "next"

export function getPublicSiteBaseUrl(): URL | undefined {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    "http://localhost:3015"

  const value = raw.startsWith("http") ? raw : `https://${raw}`

  try {
    return new URL(value)
  } catch {
    return undefined
  }
}

export function truncate(s: string, max = 160) {
  const t = s.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trimEnd()}…`
}

export function ogImages(...urls: Array<string | null | undefined>) {
  return urls.filter((u): u is string => typeof u === "string" && u.length > 0)
}

export function withBase(meta: Metadata): Metadata {
  const base = getPublicSiteBaseUrl()
  if (!base) return meta
  return { ...meta, metadataBase: base }
}

