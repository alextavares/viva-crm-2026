-- Improve public site search: allow searching by external_id (import code) and UUID.
-- Example: "77848263" should match external_id "univen:914949:77848263".

CREATE OR REPLACE FUNCTION public.site_list_properties(
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

