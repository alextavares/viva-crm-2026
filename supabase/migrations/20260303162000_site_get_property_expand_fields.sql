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
        )
      )
    END;
$$;

REVOKE ALL ON FUNCTION public.site_get_property(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_get_property(text, uuid) TO anon, authenticated;
