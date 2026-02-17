import { NextResponse } from "next/server"
import { isAppHost, isPreviewHost, normalizeHost } from "@/lib/public-site/host"

export const dynamic = "force-dynamic"

async function resolveSlugByDomain(domain: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || !domain) return null

  try {
    const res = await fetch(`${url}/rest/v1/rpc/site_resolve_slug_by_domain`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_domain: domain }),
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data === "string" && data.trim().length > 0 ? data : null
  } catch {
    return null
  }
}

function robotsForPreview(origin: string) {
  return [
    "User-agent: *",
    "Disallow: /",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n")
}

function robotsForAppHost(origin: string) {
  return [
    "User-agent: *",
    "Allow: /precos",
    "Disallow: /api/",
    "Disallow: /auth/",
    "Disallow: /dashboard",
    "Disallow: /contacts",
    "Disallow: /appointments",
    "Disallow: /properties",
    "Disallow: /integrations",
    "Disallow: /settings",
    "Disallow: /login",
    "Disallow: /register",
    "Disallow: /s/",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n")
}

function robotsForCustomDomain(origin: string) {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /auth/",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n")
}

export async function GET(req: Request) {
  const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || ""
  const host = normalizeHost(hostHeader)
  const origin = new URL(req.url).origin

  if (isPreviewHost(host)) {
    return new NextResponse(robotsForPreview(origin), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    })
  }

  if (isAppHost(host)) {
    return new NextResponse(robotsForAppHost(origin), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    })
  }

  const slug = await resolveSlugByDomain(host)
  if (slug) {
    return new NextResponse(robotsForCustomDomain(origin), {
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    })
  }

  // Unknown host: safest policy.
  return new NextResponse("User-agent: *\nDisallow: /\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  })
}

