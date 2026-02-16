import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { siteGetSettings, siteListProperties } from "@/lib/site"

export const dynamic = "force-dynamic"

const MAX_URLS = 1000
const PAGE_SIZE = 200

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function sitePath(slug: string, path = "") {
  return `/s/${encodeURIComponent(slug)}${path}`
}

function abs(origin: string, pathname: string) {
  return new URL(pathname, origin).toString()
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!slug) return new NextResponse("Not found", { status: 404 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return new NextResponse("Server misconfigured", { status: 500 })

  const origin = new URL(req.url).origin
  const supabase = createClient(url, key)

  // If the site doesn't exist (or isn't public), return 404 to avoid indexing garbage.
  const settingsRes = await siteGetSettings(supabase, slug)
  if (settingsRes.error) return new NextResponse("Not found", { status: 404 })
  if (!settingsRes.data) return new NextResponse("Not found", { status: 404 })

  const urls: string[] = [
    abs(origin, sitePath(slug)),
    abs(origin, sitePath(slug, "/about")),
    abs(origin, sitePath(slug, "/contact")),
    abs(origin, sitePath(slug, "/lgpd")),
  ]

  for (let offset = 0; urls.length < MAX_URLS; offset += PAGE_SIZE) {
    const limit = Math.min(PAGE_SIZE, MAX_URLS - urls.length)
    const { data, error } = await siteListProperties(supabase, {
      siteSlug: slug,
      limit,
      offset,
    })

    if (error) break
    if (!data || data.length === 0) break

    for (const p of data) {
      if (urls.length >= MAX_URLS) break
      urls.push(abs(origin, sitePath(slug, `/imovel/${encodeURIComponent(p.id)}`)))
    }

    if (data.length < limit) break
  }

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`).join("\n") +
    `\n</urlset>\n`

  return new NextResponse(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

