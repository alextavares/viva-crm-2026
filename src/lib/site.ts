import type {
  PostgrestResponse,
  PostgrestSingleResponse,
  SupabaseClient,
} from "@supabase/supabase-js"

export type SiteTheme = "search_first" | "search_highlights" | "premium" | "trust_first" | "compact_mobile"

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
  public_code?: string | null
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
  public_code?: string | null
  title: string
  description: string | null
  price: number | null
  type: string | null
  features: Record<string, unknown> | null
  images: string[] | null
  image_paths?: string[] | null
  address: { city: string | null; state: string | null; neighborhood: string | null } | null
  responsible_broker?: SiteResponsibleBroker | null
}

export type SiteResponsibleBroker = {
  full_name: string | null
  avatar_url: string | null
  avatar_path: string | null
  creci: string | null
  whatsapp: string | null
  response_time_label: string | null
}

export type SiteCreateLeadResult = {
  contact_id: string
  deduped: boolean
}

/**
 * Canonical row shapes returned by the `api.site_*` RPCs. These are bounded
 * projections (no internal ids except where the contract exposes them, no
 * unpublished rows, page-size capped server-side).
 */
export type CanonicalSiteSettingsRow = {
  theme: string | null
  brand_name: string | null
  headline: string | null
  description: string | null
  primary_color: string | null
  secondary_color: string | null
  logo_path: string | null
  public_phone: string | null
  public_email: string | null
  public_address: string | null
  analytics_id: string | null
  verification_id: string | null
  onboarding_complete: boolean | null
}

export type CanonicalSitePropertyRow = {
  public_code: string
  external_id: string | null
  title: string | null
  description: string | null
  type: string | null
  transaction_type: string | null
  price: number | null
  built_area: number | null
  total_area: number | null
  address: { city: string | null; neighborhood: string | null } | null
  features: string[] | null
  image_paths: string[] | null
}

export type CanonicalSitePropertyDetail = Omit<CanonicalSitePropertyRow, "address"> & {
  address: { city: string | null; neighborhood: string | null } | null
}

export type CanonicalSiteNewsRow = {
  slug: string
  title: string
  excerpt: string | null
  content: string | null
  published_at: string | null
}

export type CanonicalSiteLinkRow = {
  title: string
  url: string
  description: string | null
  sort_order: number
}

/**
 * Map a canonical feed row onto the UI card. The contract exposes no internal
 * UUID on list rows, so the stable `public_code` is the card identity and the
 * detail-page key.
 */
export function toSitePropertyCard(row: CanonicalSitePropertyRow): SitePropertyCard {
  return {
    id: row.public_code,
    public_code: row.public_code,
    title: row.title ?? "",
    price: row.price,
    type: row.type,
    city: row.address?.city ?? null,
    state: null,
    neighborhood: row.address?.neighborhood ?? null,
    thumbnail_url: null,
    thumbnail_path: row.image_paths?.[0] ?? null,
    bedrooms: null,
    bathrooms: null,
    area: row.built_area ?? row.total_area ?? null,
  }
}

export async function siteGetSettings(supabase: SupabaseClient, slug: string) {
  const res = await supabase.schema("api").rpc("site_get_settings", {
    p_slug: slug,
  })
  return res as PostgrestSingleResponse<CanonicalSiteSettingsRow>
}

export type SiteListPropertiesArgs = {
  slug: string
  page?: number | null
  pageSize?: number | null
}

export async function siteListProperties(supabase: SupabaseClient, args: SiteListPropertiesArgs) {
  const res = await supabase.schema("api").rpc("site_list_properties", {
    p_slug: args.slug,
    p_page: args.page ?? 1,
    p_page_size: args.pageSize ?? 100,
  })
  return res as PostgrestResponse<CanonicalSitePropertyRow>
}

export async function siteGetProperty(supabase: SupabaseClient, slug: string, propertyId: string) {
  const res = await supabase.schema("api").rpc("site_get_property", {
    p_slug: slug,
    p_property_id: propertyId,
  })
  return res as PostgrestSingleResponse<CanonicalSitePropertyDetail>
}

export type SiteListNewsArgs = {
  slug: string
  page?: number | null
  pageSize?: number | null
}

export async function siteListNews(supabase: SupabaseClient, args: SiteListNewsArgs) {
  const res = await supabase.schema("api").rpc("site_list_news", {
    p_slug: args.slug,
    p_page: args.page ?? 1,
    p_page_size: args.pageSize ?? 100,
  })
  return res as PostgrestResponse<CanonicalSiteNewsRow>
}

export async function siteGetNews(supabase: SupabaseClient, slug: string, newsSlug: string) {
  const res = await supabase.schema("api").rpc("site_get_news", {
    p_slug: slug,
    p_slug_key: newsSlug,
  })
  return res as PostgrestSingleResponse<CanonicalSiteNewsRow>
}

export async function siteListLinks(supabase: SupabaseClient, slug: string) {
  const res = await supabase.schema("api").rpc("site_list_links", {
    p_slug: slug,
  })
  return res as PostgrestResponse<CanonicalSiteLinkRow>
}

export async function siteResolveSlugByDomain(supabase: SupabaseClient, domain: string) {
  const res = await supabase.schema("api").rpc("site_resolve_slug_by_domain", {
    p_domain: domain,
  })
  return res as PostgrestSingleResponse<string>
}

export type SiteCreateLeadArgs = {
  slug: string
  name: string
  phone: string
  email?: string | null
  propertyId?: string | null
  message?: string | null
  sourceDomain?: string | null
  idempotencyKey?: string | null
}

/**
 * Server-only: `api.site_create_lead` is granted to `service_role` exclusively.
 * Browser callers must POST to `/api/public/s/[slug]/lead` instead of calling
 * this helper with an anon client.
 */
export async function siteCreateLead(supabase: SupabaseClient, args: SiteCreateLeadArgs) {
  const res = await supabase.schema("api").rpc("site_create_lead", {
    p_slug: args.slug,
    p_name: args.name,
    p_phone: args.phone,
    p_email: args.email ?? null,
    p_property_id: args.propertyId ?? null,
    p_message: args.message ?? null,
    p_source_domain: args.sourceDomain ?? null,
    p_idempotency_key: args.idempotencyKey ?? null,
  })
  return res as PostgrestSingleResponse<{ accepted: boolean; deduped: boolean; reference: string }>
}
