-- Public-facing property code (easy to type/copy): V-1, V-2, ...
-- Keep external_id for integrations/import lineage.

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS public_code TEXT;

CREATE TABLE IF NOT EXISTS public.property_public_code_sequences (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backfill null/blank codes per organization, continuing after existing V-<n> if present.
WITH org_max AS (
  SELECT
    p.organization_id,
    COALESCE(
      MAX(
        CASE
          WHEN p.public_code ~ '^V-[0-9]+$'
            THEN substring(p.public_code from '^V-([0-9]+)$')::bigint
          ELSE 0
        END
      ),
      0
    ) AS max_num
  FROM public.properties p
  GROUP BY p.organization_id
),
to_fill AS (
  SELECT
    p.id,
    p.organization_id,
    ROW_NUMBER() OVER (PARTITION BY p.organization_id ORDER BY p.created_at, p.id) AS rn
  FROM public.properties p
  WHERE COALESCE(NULLIF(BTRIM(p.public_code), ''), NULL) IS NULL
),
assigned AS (
  SELECT
    f.id,
    'V-' || (COALESCE(m.max_num, 0) + f.rn)::text AS new_code
  FROM to_fill f
  LEFT JOIN org_max m ON m.organization_id = f.organization_id
)
UPDATE public.properties p
SET public_code = a.new_code
FROM assigned a
WHERE p.id = a.id;

-- Initialize/update sequence cursor per organization.
INSERT INTO public.property_public_code_sequences (organization_id, last_value, updated_at)
SELECT
  p.organization_id,
  COALESCE(
    MAX(
      CASE
        WHEN p.public_code ~ '^V-[0-9]+$'
          THEN substring(p.public_code from '^V-([0-9]+)$')::bigint
        ELSE 0
      END
    ),
    0
  ) AS last_value,
  NOW()
FROM public.properties p
GROUP BY p.organization_id
ON CONFLICT (organization_id) DO UPDATE
SET
  last_value = EXCLUDED.last_value,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.assign_property_public_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  IF NEW.public_code IS NOT NULL AND BTRIM(NEW.public_code) <> '' THEN
    RETURN NEW;
  END IF;

  IF NEW.organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required to assign public_code';
  END IF;

  INSERT INTO public.property_public_code_sequences (organization_id, last_value, updated_at)
  VALUES (NEW.organization_id, 1, NOW())
  ON CONFLICT (organization_id) DO UPDATE
  SET
    last_value = public.property_public_code_sequences.last_value + 1,
    updated_at = NOW()
  RETURNING last_value INTO v_next;

  NEW.public_code := 'V-' || v_next::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_property_public_code ON public.properties;
CREATE TRIGGER trg_assign_property_public_code
BEFORE INSERT ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.assign_property_public_code();

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_org_public_code_unique
  ON public.properties (organization_id, public_code)
  WHERE public_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_properties_public_code
  ON public.properties (public_code);

ALTER TABLE public.properties
ALTER COLUMN public_code SET NOT NULL;

-- Public site list: include public_code and allow searching by it.
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
  public_code text,
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
          OR COALESCE(p.public_code, '') ILIKE ('%' || p_q || '%')
          OR COALESCE(p.external_id, '') ILIKE ('%' || p_q || '%')
          OR (
            regexp_replace(p_q, '[^0-9]', '', 'g') <> ''
            AND COALESCE(p.public_code, '') ILIKE ('%' || regexp_replace(p_q, '[^0-9]', '', 'g') || '%')
          )
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
    p.public_code,
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
    CASE WHEN (p.features->>'area') ~ '^[0-9]+(\.[0-9]+)?$' THEN (p.features->>'area')::numeric END AS area
  FROM base p
  ORDER BY p.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 24), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.site_list_properties(text, text, text, text, text, numeric, numeric, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_list_properties(text, text, text, text, text, numeric, numeric, int, int) TO anon, authenticated;

-- Public site property detail: include public_code for easy reference.
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
        'public_code', (SELECT public_code FROM prop),
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
