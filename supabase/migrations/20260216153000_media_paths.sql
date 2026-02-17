-- Phase 2 (media abstraction): persist storage paths alongside public URLs.
-- Safe, additive migration:
-- - Adds *_path columns
-- - Backfills paths from existing Supabase public URLs when possible
-- - Updates public RPCs to expose path metadata for future CDN/storage migration

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS image_paths TEXT[] DEFAULT '{}'::text[];

ALTER TABLE public.site_settings
ADD COLUMN IF NOT EXISTS logo_path TEXT;

ALTER TABLE public.site_banners
ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Backfill properties.image_paths from properties.images (only for Supabase public URLs in `properties` bucket).
UPDATE public.properties p
SET image_paths = x.paths
FROM (
  SELECT
    id,
    COALESCE(
      array_agg(clean_path) FILTER (WHERE clean_path IS NOT NULL),
      '{}'::text[]
    ) AS paths
  FROM (
    SELECT
      p0.id,
      CASE
        WHEN img ~ '/storage/v1/object/public/properties/' THEN
          NULLIF(
            regexp_replace(
              regexp_replace(img, '^.*?/storage/v1/object/public/properties/', ''),
              '[?#].*$',
              ''
            ),
            ''
          )
        ELSE NULL
      END AS clean_path
    FROM public.properties p0
    CROSS JOIN LATERAL unnest(COALESCE(p0.images, '{}'::text[])) AS img
  ) s
  GROUP BY id
) x
WHERE p.id = x.id
  AND (p.image_paths IS NULL OR COALESCE(array_length(p.image_paths, 1), 0) = 0)
  AND COALESCE(array_length(p.images, 1), 0) > 0
  AND COALESCE(array_length(x.paths, 1), 0) > 0;

-- Backfill site_settings.logo_path from logo_url.
UPDATE public.site_settings
SET logo_path = NULLIF(
  regexp_replace(
    regexp_replace(logo_url, '^.*?/storage/v1/object/public/site-assets/', ''),
    '[?#].*$',
    ''
  ),
  ''
)
WHERE (logo_path IS NULL OR logo_path = '')
  AND logo_url ~ '/storage/v1/object/public/site-assets/';

-- Backfill site_banners.image_path from image_url.
UPDATE public.site_banners
SET image_path = NULLIF(
  regexp_replace(
    regexp_replace(image_url, '^.*?/storage/v1/object/public/site-assets/', ''),
    '[?#].*$',
    ''
  ),
  ''
)
WHERE (image_path IS NULL OR image_path = '')
  AND image_url ~ '/storage/v1/object/public/site-assets/';

-- Feed: consider image_paths as valid photos too.
CREATE OR REPLACE FUNCTION public.feed_properties(p_portal text, p_feed_token text)
RETURNS SETOF public.properties
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.portal_integrations i
  JOIN public.properties p ON p.organization_id = i.organization_id
  WHERE i.portal = p_portal
    AND i.status = 'active'
    AND (i.config->>'feed_token') = p_feed_token
    AND COALESCE((i.config->>'export_enabled')::boolean, false) IS TRUE
    AND COALESCE(p.hide_from_site, false) IS NOT TRUE
    AND (
      COALESCE((i.config->>'send_only_available')::boolean, false) IS NOT TRUE
      OR p.status = 'available'
    )
    AND (
      COALESCE((i.config->>'send_only_with_photos')::boolean, false) IS NOT TRUE
      OR (
        (p.images IS NOT NULL AND array_length(p.images, 1) > 0)
        OR (p.image_paths IS NOT NULL AND array_length(p.image_paths, 1) > 0)
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.feed_properties(text, text) TO anon, authenticated;

-- Public settings payload now includes logo_path / banner image_path.
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
      s.email
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

-- Public list now exposes thumbnail_path (for storage migration fallback).
DROP FUNCTION IF EXISTS public.site_list_properties(text, text, text, text, text, numeric, numeric, int, int);

CREATE FUNCTION public.site_list_properties(
  p_site_slug text,
  p_q text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  price numeric,
  type text,
  city text,
  state text,
  neighborhood text,
  thumbnail_url text,
  thumbnail_path text,
  bedrooms int,
  bathrooms int,
  area numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (
    SELECT id
    FROM public.organizations
    WHERE slug = p_site_slug
    LIMIT 1
  ),
  base AS (
    SELECT p.*
    FROM public.properties p
    JOIN org ON org.id = p.organization_id
    WHERE p.status = 'available'
      AND p.hide_from_site IS FALSE
      AND (p_type IS NULL OR p.type = p_type)
      AND (p_min_price IS NULL OR p.price >= p_min_price)
      AND (p_max_price IS NULL OR p.price <= p_max_price)
      AND (
        p_city IS NULL
        OR COALESCE(p.address->>'city', '') ILIKE ('%' || p_city || '%')
      )
      AND (
        p_neighborhood IS NULL
        OR COALESCE(p.address->>'neighborhood', '') ILIKE ('%' || p_neighborhood || '%')
      )
      AND (
        p_q IS NULL
        OR (
          COALESCE(p.title, '') ILIKE ('%' || p_q || '%')
          OR COALESCE(p.description, '') ILIKE ('%' || p_q || '%')
          OR COALESCE(p.external_id, '') ILIKE ('%' || p_q || '%')
          OR (
            regexp_replace(p_q, '[^0-9]', '', 'g') <> ''
            AND COALESCE(p.external_id, '') ILIKE ('%' || regexp_replace(p_q, '[^0-9]', '', 'g') || '%')
          )
          OR (
            p_q ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            AND p.id = p_q::uuid
          )
        )
      )
  )
  SELECT
    p.id,
    p.title,
    p.price,
    p.type,
    p.address->>'city' AS city,
    p.address->>'state' AS state,
    p.address->>'neighborhood' AS neighborhood,
    NULLIF(p.images[1], '') AS thumbnail_url,
    NULLIF(p.image_paths[1], '') AS thumbnail_path,
    CASE WHEN (p.features->>'bedrooms') ~ '^[0-9]+$' THEN (p.features->>'bedrooms')::int END AS bedrooms,
    CASE WHEN (p.features->>'bathrooms') ~ '^[0-9]+$' THEN (p.features->>'bathrooms')::int END AS bathrooms,
    CASE WHEN (p.features->>'area') ~ '^[0-9]+(\\.[0-9]+)?$' THEN (p.features->>'area')::numeric END AS area
  FROM base p
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.site_list_properties(text, text, text, text, text, numeric, numeric, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_list_properties(text, text, text, text, text, numeric, numeric, int, int) TO anon, authenticated;

-- Public property payload now includes image_paths.
CREATE OR REPLACE FUNCTION public.site_get_property(p_site_slug text, p_property_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (
    SELECT id, slug
    FROM public.organizations
    WHERE slug = p_site_slug
    LIMIT 1
  ),
  prop AS (
    SELECT p.*
    FROM public.properties p
    JOIN org ON org.id = p.organization_id
    WHERE p.id = p_property_id
      AND p.status = 'available'
      AND p.hide_from_site IS FALSE
    LIMIT 1
  )
  SELECT
    CASE
      WHEN (SELECT id FROM prop) IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', (SELECT id FROM prop),
        'title', (SELECT title FROM prop),
        'description', (SELECT description FROM prop),
        'price', (SELECT price FROM prop),
        'type', (SELECT type FROM prop),
        'features', (SELECT features FROM prop),
        'images', (SELECT images FROM prop),
        'image_paths', (SELECT image_paths FROM prop),
        'address', jsonb_build_object(
          'city', (SELECT address->>'city' FROM prop),
          'state', (SELECT address->>'state' FROM prop),
          'neighborhood', (SELECT address->>'neighborhood' FROM prop)
        )
      )
    END;
$$;

REVOKE ALL ON FUNCTION public.site_get_property(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_get_property(text, uuid) TO anon, authenticated;
