-- Ensure portal feeds respect the same publish toggle used by the public site.
-- Decision (MVP): hide_from_site=true excludes the property from both the site and portal exports.

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
      OR (p.images IS NOT NULL AND array_length(p.images, 1) > 0)
    );
$$;

GRANT EXECUTE ON FUNCTION public.feed_properties(text, text) TO anon, authenticated;

