import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { PortalKey } from "@/lib/integrations"
import { PORTALS } from "@/lib/integrations"
import { resolveMediaPathUrl } from "@/lib/media"

type FeedPropertyRow = {
  id: string
  title: string | null
  status: string | null
  type: string | null
  price: string | number | null
  hide_from_site: boolean | null
  description: string | null
  images: string[] | null
  image_paths: string[] | null
  external_id: string | null
  updated_at: string | null
  address: {
    full_address?: string | null
    street?: string | null
    number?: string | null
    neighborhood?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    country?: string | null
  } | null
}

function escapeXml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;")
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ portal: string; token: string }> }
) {
  const { portal, token } = await params
  if (!PORTALS.includes(portal as PortalKey) || !token) {
    return new NextResponse("Not found", { status: 404 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    return new NextResponse("Server misconfigured", { status: 500 })
  }

  const supabase = createClient(url, key)
  const { data, error } = await supabase.rpc("feed_properties", {
    p_portal: portal,
    p_feed_token: token,
  })

  if (error || !Array.isArray(data)) {
    return new NextResponse("Not found", { status: 404 })
  }

  // Filter out hidden listings. This matches the product's notion of "published".
  // (We keep the SQL function generic; this extra guard prevents accidental exports.)
  const rows = (data as unknown as FeedPropertyRow[]).filter((p) => p.hide_from_site !== true)
  const now = new Date().toISOString()

  // Generic feed (placeholder). Each portal will require its own schema later.
  const items = rows
    .map((p) => {
      const id = String(p.id ?? "")
      const title = String(p.title ?? "")
      const status = String(p.status ?? "")
      const type = String(p.type ?? "")
      const price = p.price == null ? "" : String(p.price)
      const address = p.address?.full_address ? String(p.address.full_address) : ""
      const desc = p.description ? String(p.description) : ""
      const externalId = p.external_id ? String(p.external_id) : ""
      const updatedAt = p.updated_at ? String(p.updated_at) : ""

      const imageUrls = Array.isArray(p.images) ? p.images : []
      const imagePaths = Array.isArray(p.image_paths) ? p.image_paths : []
      const images = imageUrls.length
        ? imageUrls.map((url, index) => resolveMediaPathUrl("properties", imagePaths[index]) ?? String(url))
        : imagePaths
            .map((path) => resolveMediaPathUrl("properties", path))
            .filter((url): url is string => typeof url === "string" && url.length > 0)
      const imagesXml = images.length
        ? ["    <images>", ...images.map((src) => `      <image>${escapeXml(String(src))}</image>`), "    </images>"].join("\n")
        : "    <images />"

      const addr = p.address ?? null
      const city = addr?.city ? String(addr.city) : ""
      const state = addr?.state ? String(addr.state) : ""
      const zip = addr?.zip ? String(addr.zip) : ""

      return [
        `  <property id="${escapeXml(id)}">`,
        externalId ? `    <external_id>${escapeXml(externalId)}</external_id>` : `    <external_id />`,
        `    <title>${escapeXml(title)}</title>`,
        `    <status>${escapeXml(status)}</status>`,
        `    <type>${escapeXml(type)}</type>`,
        `    <price>${escapeXml(price)}</price>`,
        `    <address>${escapeXml(address)}</address>`,
        `    <address_city>${escapeXml(city)}</address_city>`,
        `    <address_state>${escapeXml(state)}</address_state>`,
        `    <address_zip>${escapeXml(zip)}</address_zip>`,
        `    <updated_at>${escapeXml(updatedAt || now)}</updated_at>`,
        desc ? `    <description>${escapeXml(desc)}</description>` : `    <description />`,
        imagesXml,
        `  </property>`,
      ].join("\n")
    })
    .join("\n")

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<feed portal="${escapeXml(portal)}" generatedAt="${escapeXml(now)}">`,
    `<properties>`,
    items,
    `</properties>`,
    `</feed>`,
    ``,
  ].join("\n")

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      // Avoid caching while the format is evolving.
      "cache-control": "no-store",
    },
  })
}
