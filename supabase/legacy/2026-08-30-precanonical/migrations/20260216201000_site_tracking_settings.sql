-- Site tracking fields (GA4, Meta Pixel, verification tokens, Google Ads conversion).
-- Idempotent migration.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS ga4_measurement_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT,
  ADD COLUMN IF NOT EXISTS google_site_verification TEXT,
  ADD COLUMN IF NOT EXISTS facebook_domain_verification TEXT,
  ADD COLUMN IF NOT EXISTS google_ads_conversion_id TEXT,
  ADD COLUMN IF NOT EXISTS google_ads_conversion_label TEXT;

CREATE OR REPLACE FUNCTION public.site_get_settings(p_site_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (
    SELECT id, name, slug
    FROM public.organizations
    WHERE slug = p_site_slug
    LIMIT 1
  ),
  settings AS (
    SELECT
      COALESCE(s.theme, 'search_first') AS theme,
      COALESCE(s.brand_name, org.name) AS brand_name,
      s.logo_url,
      s.logo_path,
      s.primary_color,
      s.secondary_color,
      s.whatsapp,
      s.phone,
      s.email,
      s.ga4_measurement_id,
      s.meta_pixel_id,
      s.google_site_verification,
      s.facebook_domain_verification,
      s.google_ads_conversion_id,
      s.google_ads_conversion_label
    FROM org
    LEFT JOIN public.site_settings s ON s.organization_id = org.id
  ),
  pages AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'key', p.key,
        'title', p.title,
        'content', p.content,
        'updated_at', p.updated_at
      )
      ORDER BY p.key
    ) AS pages
    FROM org
    JOIN public.site_pages p ON p.organization_id = org.id
    WHERE p.is_published IS TRUE
  ),
  banners AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'placement', b.placement,
        'variant', b.variant,
        'title', b.title,
        'body', b.body,
        'image_url', b.image_url,
        'image_path', b.image_path,
        'link_url', b.link_url,
        'starts_at', b.starts_at,
        'ends_at', b.ends_at,
        'priority', b.priority
      )
      ORDER BY b.priority DESC, b.created_at DESC
    ) AS banners
    FROM org
    JOIN public.site_banners b ON b.organization_id = org.id
    WHERE b.is_active IS TRUE
      AND (b.starts_at IS NULL OR b.starts_at <= now())
      AND (b.ends_at IS NULL OR b.ends_at >= now())
  )
  SELECT
    CASE
      WHEN (SELECT id FROM org) IS NULL THEN NULL
      ELSE jsonb_build_object(
        'slug', (SELECT slug FROM org),
        'settings', (SELECT to_jsonb(settings) FROM settings),
        'pages', COALESCE((SELECT pages FROM pages), '[]'::jsonb),
        'banners', COALESCE((SELECT banners FROM banners), '[]'::jsonb)
      )
    END;
$$;

REVOKE ALL ON FUNCTION public.site_get_settings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_get_settings(text) TO anon, authenticated;
