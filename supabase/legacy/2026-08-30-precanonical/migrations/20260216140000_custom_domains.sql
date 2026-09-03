-- Custom domains (one per organization) for public websites.
-- MVP: support only `www` domains (customer should redirect apex -> www in DNS/provider).

CREATE TABLE IF NOT EXISTS public.custom_domains (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'error')),
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON public.custom_domains(domain);

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View custom domains in same org" ON custom_domains';
  EXECUTE 'CREATE POLICY "View custom domains in same org" ON custom_domains FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage custom domains" ON custom_domains';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage custom domains" ON custom_domains FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Public (anon) resolver: map verified domain -> site slug.
CREATE OR REPLACE FUNCTION public.site_resolve_slug_by_domain(p_domain text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH x AS (
    SELECT lower(btrim(COALESCE(p_domain, ''))) AS dom
  )
  SELECT o.slug
  FROM x
  JOIN public.custom_domains d ON lower(d.domain) = x.dom
  JOIN public.organizations o ON o.id = d.organization_id
  WHERE x.dom <> ''
    AND d.status = 'verified'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.site_resolve_slug_by_domain(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_resolve_slug_by_domain(text) TO anon, authenticated;

