ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS creci text,
  ADD COLUMN IF NOT EXISTS public_whatsapp text,
  ADD COLUMN IF NOT EXISTS public_profile_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_display_name text;

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
  ),
  broker AS (
    SELECT
      pr.id,
      COALESCE(NULLIF(BTRIM(pr.public_display_name), ''), NULLIF(BTRIM(pr.full_name), '')) AS full_name,
      NULLIF(BTRIM(pr.avatar_url), '') AS avatar_url,
      NULL::text AS avatar_path,
      NULLIF(BTRIM(pr.creci), '') AS creci,
      NULLIF(BTRIM(pr.public_whatsapp), '') AS whatsapp
    FROM public.profiles pr
    JOIN prop ON prop.assigned_to = pr.id
    WHERE pr.organization_id = (SELECT id FROM org)
      AND pr.role = 'broker'
      AND pr.is_active IS TRUE
      AND COALESCE(pr.public_profile_enabled, false) IS TRUE
      AND COALESCE(NULLIF(BTRIM(pr.public_display_name), ''), NULLIF(BTRIM(pr.full_name), '')) IS NOT NULL
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
        'transaction_type', (SELECT transaction_type FROM prop),
        'purpose', (SELECT purpose FROM prop),
        'financing_allowed', (SELECT financing_allowed FROM prop),
        'total_area', (SELECT total_area FROM prop),
        'built_area', (SELECT built_area FROM prop),
        'features', (SELECT features FROM prop),
        'images', (SELECT images FROM prop),
        'image_paths', (SELECT image_paths FROM prop),
        'address', jsonb_build_object(
          'city', (SELECT address->>'city' FROM prop),
          'state', (SELECT address->>'state' FROM prop),
          'neighborhood', (SELECT address->>'neighborhood' FROM prop)
        ),
        'responsible_broker', CASE
          WHEN (SELECT id FROM broker) IS NULL THEN NULL
          ELSE jsonb_build_object(
            'full_name', (SELECT full_name FROM broker),
            'avatar_url', (SELECT avatar_url FROM broker),
            'avatar_path', (SELECT avatar_path FROM broker),
            'creci', (SELECT creci FROM broker),
            'whatsapp', (SELECT whatsapp FROM broker),
            'response_time_label', NULL
          )
        END
      )
    END;
$$;

REVOKE ALL ON FUNCTION public.site_get_property(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_get_property(text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
