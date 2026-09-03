import { cache } from "react"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import {
  siteGetNews,
  siteGetProperty,
  siteGetSettings,
  siteListLinks,
  siteListNews,
  siteListProperties,
  toSitePropertyCard,
  type CanonicalSitePropertyRow,
  type SiteGetSettingsResponse,
  type SitePropertyCard,
  type SitePublicBanner,
  type SitePublicProperty,
} from "@/lib/site"

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createServiceClient(url, key)
}

export type PublicSiteFilter = {
  q?: string | null
  city?: string | null
  neighborhood?: string | null
  type?: string | null
  minPrice?: number | null
  maxPrice?: number | null
}

/**
 * The canonical `site_list_properties` RPC exposes no search filters, so the
 * bounded page is filtered in memory. Documented behavior bound: at most one
 * RPC page (default 100 rows, pageSize capped server-side) is considered.
 */
export function applyPublicSiteFilter(
  cards: SitePropertyCard[],
  filter: PublicSiteFilter
): SitePropertyCard[] {
  const q = (filter.q ?? "").trim().toLowerCase()
  const city = (filter.city ?? "").trim().toLowerCase()
  const neighborhood = (filter.neighborhood ?? "").trim().toLowerCase()
  const type = (filter.type ?? "").trim().toLowerCase()
  return cards.filter((card) => {
    if (city && (card.city ?? "").toLowerCase() !== city) return false
    if (neighborhood && (card.neighborhood ?? "").toLowerCase() !== neighborhood) return false
    if (type && (card.type ?? "").toLowerCase() !== type) return false
    if (filter.minPrice != null && (card.price ?? 0) < filter.minPrice) return false
    if (filter.maxPrice != null && (card.price ?? Infinity) > filter.maxPrice) return false
    if (q) {
      const hay = `${card.title ?? ""} ${card.public_code ?? ""}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

async function getPublicBanners(slug: string): Promise<SitePublicBanner[]> {
  const svc = serviceClient()
  if (!svc) return []
  const { data: org } = await svc.from("organizations").select("id").eq("slug", slug).single()
  if (!org) return []
  const now = new Date().toISOString()
  const { data } = await svc
    .from("site_banners")
    .select("id, placement, variant, title, body, image_path, link_url, starts_at, ends_at, priority")
    .eq("organization_id", org.id)
    .eq("is_active", true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("priority", { ascending: false })
    .limit(50)
  return (data ?? []).map((b) => ({
    id: b.id,
    placement: b.placement,
    variant: b.variant,
    title: b.title,
    body: b.body,
    image_url: null,
    image_path: b.image_path,
    link_url: b.link_url,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    priority: b.priority ?? 0,
  }))
}

export const getPublicSite = cache(async (slug: string): Promise<SiteGetSettingsResponse | null> => {
  const supabase = await createServerClient()
  const { data } = await siteGetSettings(supabase, slug)
  if (!data) return null
  const banners = await getPublicBanners(slug)
  return {
    slug,
    settings: {
      theme: (data.theme as SiteGetSettingsResponse["settings"]["theme"]) ?? "search_first",
      brand_name: data.brand_name,
      logo_url: null,
      logo_path: data.logo_path,
      primary_color: data.primary_color,
      secondary_color: data.secondary_color,
      whatsapp: data.public_phone,
      phone: data.public_phone,
      email: data.public_email,
    },
    // CANONICAL CONTRACT GAP: `site_pages` has no anon-accessible RPC, so the
    // public composite carries no pages. Banners are read server-side with a
    // bounded, published-only select (see getPublicBanners).
    pages: [],
    banners,
  }
})

export const getPublicPropertyList = cache(
  async (slug: string, page = 1, pageSize = 24, filter: PublicSiteFilter = {}) => {
    const supabase = await createServerClient()
    const { data } = await siteListProperties(supabase, { slug, page, pageSize })
    const cards = ((data ?? []) as CanonicalSitePropertyRow[]).map(toSitePropertyCard)
    return applyPublicSiteFilter(cards, filter)
  }
)

export const getPublicProperty = cache(
  async (slug: string, publicCode: string): Promise<SitePublicProperty | null> => {
    // CANONICAL CONTRACT GAP: `site_get_property` requires the internal UUID,
    // which `site_list_properties` does not expose. Resolve the public code
    // server-side with the same published predicates the RPC enforces.
    const svc = serviceClient()
    if (!svc) return null
    const { data: org } = await svc.from("organizations").select("id").eq("slug", slug).single()
    if (!org) return null
    const { data: match } = await svc
      .from("properties")
      .select("id")
      .eq("organization_id", org.id)
      .eq("public_code", publicCode)
      .eq("publish_to_site", true)
      .in("status", ["available", "reserved"])
      .single()
    if (!match) return null

    const supabase = await createServerClient()
    const { data } = await siteGetProperty(supabase, slug, match.id)
    if (!data) return null
    return {
      id: match.id,
      public_code: data.public_code,
      title: data.title ?? "",
      description: data.description,
      price: data.price,
      type: data.type,
      features: null,
      images: null,
      image_paths: data.image_paths,
      address: data.address
        ? { city: data.address.city ?? null, state: null, neighborhood: data.address.neighborhood ?? null }
        : null,
      responsible_broker: null,
    }
  }
)

export const getPublicNews = cache(async (slug: string, newsSlug: string) => {
  const supabase = await createServerClient()
  const { data } = await siteGetNews(supabase, slug, newsSlug)
  if (!data) return null
  return {
    id: data.slug,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    content: data.content,
    published_at: data.published_at,
    created_at: data.published_at,
    updated_at: data.published_at,
  }
})

export const getPublicNewsList = cache(async (slug: string, limit = 12, offset = 0) => {
  const supabase = await createServerClient()
  const pageSize = Math.max(1, limit)
  const page = Math.floor(Math.max(0, offset) / pageSize) + 1
  const { data } = await siteListNews(supabase, { slug, page, pageSize })
  return (data ?? []).map((n) => ({
    id: n.slug,
    slug: n.slug,
    title: n.title,
    excerpt: n.excerpt,
    published_at: n.published_at,
    created_at: n.published_at,
  }))
})

export const getPublicLinks = cache(async (slug: string) => {
  const supabase = await createServerClient()
  const { data } = await siteListLinks(supabase, slug)
  return (data ?? []).map((l) => ({
    id: l.url,
    title: l.title,
    url: l.url,
    description: l.description,
    sort_order: l.sort_order ?? 0,
  }))
})
