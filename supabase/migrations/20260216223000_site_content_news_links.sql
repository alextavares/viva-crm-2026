-- Site content modules: News + Useful Links (multi-tenant, public via RPC).
-- MVP scope:
-- - Admin CRUD via authenticated users (owner/manager by org)
-- - Public read only through SECURITY DEFINER RPCs

CREATE TABLE IF NOT EXISTS public.site_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_site_news_org ON public.site_news(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_news_org_published ON public.site_news(organization_id, is_published);
CREATE INDEX IF NOT EXISTS idx_site_news_org_published_at ON public.site_news(organization_id, published_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.site_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_links_org ON public.site_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_links_org_published ON public.site_links(organization_id, is_published);
CREATE INDEX IF NOT EXISTS idx_site_links_org_order ON public.site_links(organization_id, sort_order ASC, created_at DESC);

ALTER TABLE public.site_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View site news in same org" ON site_news';
  EXECUTE 'CREATE POLICY "View site news in same org" ON site_news FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage site news" ON site_news';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage site news" ON site_news FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View site links in same org" ON site_links';
  EXECUTE 'CREATE POLICY "View site links in same org" ON site_links FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage site links" ON site_links';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage site links" ON site_links FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

CREATE OR REPLACE FUNCTION public.site_list_news(
  p_site_slug text,
  p_limit int DEFAULT 12,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  slug text,
  title text,
  excerpt text,
  published_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (
    SELECT o.id
    FROM public.organizations o
    WHERE o.slug = p_site_slug
    LIMIT 1
  )
  SELECT
    n.id,
    n.slug,
    n.title,
    n.excerpt,
    n.published_at,
    n.created_at
  FROM public.site_news n
  JOIN org ON org.id = n.organization_id
  WHERE n.is_published IS TRUE
    AND (n.published_at IS NULL OR n.published_at <= now())
  ORDER BY COALESCE(n.published_at, n.created_at) DESC, n.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.site_list_news(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_list_news(text, int, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.site_get_news(
  p_site_slug text,
  p_news_slug text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (
    SELECT o.id
    FROM public.organizations o
    WHERE o.slug = p_site_slug
    LIMIT 1
  ),
  news AS (
    SELECT n.*
    FROM public.site_news n
    JOIN org ON org.id = n.organization_id
    WHERE n.slug = p_news_slug
      AND n.is_published IS TRUE
      AND (n.published_at IS NULL OR n.published_at <= now())
    LIMIT 1
  )
  SELECT
    CASE
      WHEN (SELECT id FROM news) IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', (SELECT id FROM news),
        'slug', (SELECT slug FROM news),
        'title', (SELECT title FROM news),
        'excerpt', (SELECT excerpt FROM news),
        'content', (SELECT content FROM news),
        'published_at', (SELECT published_at FROM news),
        'updated_at', (SELECT updated_at FROM news),
        'created_at', (SELECT created_at FROM news)
      )
    END;
$$;

REVOKE ALL ON FUNCTION public.site_get_news(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_get_news(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.site_list_links(
  p_site_slug text
)
RETURNS TABLE (
  id uuid,
  title text,
  url text,
  description text,
  sort_order int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (
    SELECT o.id
    FROM public.organizations o
    WHERE o.slug = p_site_slug
    LIMIT 1
  )
  SELECT
    l.id,
    l.title,
    l.url,
    l.description,
    l.sort_order
  FROM public.site_links l
  JOIN org ON org.id = l.organization_id
  WHERE l.is_published IS TRUE
  ORDER BY l.sort_order ASC, l.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.site_list_links(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_list_links(text) TO anon, authenticated;
