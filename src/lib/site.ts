import type {
  PostgrestResponse,
  PostgrestSingleResponse,
  SupabaseClient,
} from "@supabase/supabase-js"

export type SiteTheme = "search_first" | "premium"

export type SitePageKey = "about" | "contact" | "lgpd"

export type SitePublicSettings = {
  theme: SiteTheme
  brand_name: string | null
  logo_url: string | null
  logo_path?: string | null
  primary_color: string | null
  secondary_color: string | null
  whatsapp: string | null
  phone: string | null
  email: string | null
  ga4_measurement_id?: string | null
  meta_pixel_id?: string | null
  google_site_verification?: string | null
  facebook_domain_verification?: string | null
  google_ads_conversion_id?: string | null
  google_ads_conversion_label?: string | null
}

export type SitePublicPage = {
  key: SitePageKey
  title: string | null
  content: string | null
  updated_at: string | null
}

export type SiteBannerPlacement = "popup" | "topbar" | "hero" | "footer"

export type SitePublicBanner = {
  id: string
  placement: SiteBannerPlacement | string
  variant?: "compact" | "destaque" | string | null
  title: string | null
  body: string | null
  image_url: string | null
  image_path?: string | null
  link_url: string | null
  starts_at: string | null
  ends_at: string | null
  priority: number
}

export type SitePublicNewsCard = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  published_at: string | null
  created_at: string | null
}

export type SitePublicNews = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  content: string | null
  published_at: string | null
  created_at: string | null
  updated_at: string | null
}

export type SitePublicLink = {
  id: string
  title: string
  url: string
  description: string | null
  sort_order: number
}

export type SiteGetSettingsResponse = {
  slug: string
  settings: SitePublicSettings
  pages: SitePublicPage[]
  banners: SitePublicBanner[]
}

export type SitePropertyCard = {
  id: string
  title: string
  price: number | null
  type: string | null
  city: string | null
  state: string | null
  neighborhood: string | null
  thumbnail_url: string | null
  thumbnail_path?: string | null
  bedrooms: number | null
  bathrooms: number | null
  area: number | null
}

export type SitePublicProperty = {
  id: string
  title: string
  description: string | null
  price: number | null
  type: string | null
  features: Record<string, unknown> | null
  images: string[] | null
  image_paths?: string[] | null
  address: { city: string | null; state: string | null; neighborhood: string | null } | null
}

export type SiteCreateLeadResult = {
  contact_id: string
  deduped: boolean
}

export async function siteGetSettings(
  supabase: SupabaseClient,
  siteSlug: string
) {
  const res = await supabase.rpc("site_get_settings", {
    p_site_slug: siteSlug,
  })
  return res as PostgrestSingleResponse<SiteGetSettingsResponse>
}

export type SiteListPropertiesArgs = {
  siteSlug: string
  q?: string | null
  city?: string | null
  neighborhood?: string | null
  type?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  limit?: number | null
  offset?: number | null
}

export async function siteListProperties(
  supabase: SupabaseClient,
  args: SiteListPropertiesArgs
) {
  const res = await supabase.rpc("site_list_properties", {
    p_site_slug: args.siteSlug,
    p_q: args.q ?? null,
    p_city: args.city ?? null,
    p_neighborhood: args.neighborhood ?? null,
    p_type: args.type ?? null,
    p_min_price: args.minPrice ?? null,
    p_max_price: args.maxPrice ?? null,
    p_limit: args.limit ?? null,
    p_offset: args.offset ?? null,
  })
  return res as PostgrestResponse<SitePropertyCard>
}

export async function siteGetProperty(
  supabase: SupabaseClient,
  siteSlug: string,
  propertyId: string
) {
  const res = await supabase.rpc("site_get_property", {
    p_site_slug: siteSlug,
    p_property_id: propertyId,
  })
  return res as PostgrestSingleResponse<SitePublicProperty>
}

export type SiteListNewsArgs = {
  siteSlug: string
  limit?: number | null
  offset?: number | null
}

export async function siteListNews(
  supabase: SupabaseClient,
  args: SiteListNewsArgs
) {
  const res = await supabase.rpc("site_list_news", {
    p_site_slug: args.siteSlug,
    p_limit: args.limit ?? null,
    p_offset: args.offset ?? null,
  })
  return res as PostgrestResponse<SitePublicNewsCard>
}

export async function siteGetNews(
  supabase: SupabaseClient,
  siteSlug: string,
  newsSlug: string
) {
  const res = await supabase.rpc("site_get_news", {
    p_site_slug: siteSlug,
    p_news_slug: newsSlug,
  })
  return res as PostgrestSingleResponse<SitePublicNews>
}

export async function siteListLinks(
  supabase: SupabaseClient,
  siteSlug: string
) {
  const res = await supabase.rpc("site_list_links", {
    p_site_slug: siteSlug,
  })
  return res as PostgrestResponse<SitePublicLink>
}

export type SiteCreateLeadArgs = {
  siteSlug: string
  propertyId?: string | null
  name: string
  phone: string
  message?: string | null
  sourceDomain?: string | null
}

export async function siteCreateLead(
  supabase: SupabaseClient,
  args: SiteCreateLeadArgs
) {
  const res = await supabase.rpc("site_create_lead", {
    p_site_slug: args.siteSlug,
    p_property_id: args.propertyId ?? null,
    p_name: args.name,
    p_phone: args.phone,
    p_message: args.message ?? null,
    p_source_domain: args.sourceDomain ?? null,
  })
  return res as PostgrestSingleResponse<SiteCreateLeadResult>
}
