-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES (Extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  full_name TEXT,
  role TEXT DEFAULT 'broker' CHECK (role IN ('owner', 'manager', 'broker', 'assistant')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROPERTIES
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL,
  type TEXT, -- apartment, house, land, commercial
  status TEXT DEFAULT 'available', -- available, sold, rented
  features JSONB DEFAULT '{}', -- bedrooms, bathrooms, area, garage, etc.
  address JSONB DEFAULT '{}', -- street, number, city, state, zip
  images TEXT[] DEFAULT '{}',
  image_paths TEXT[] DEFAULT '{}',
  hide_from_site BOOLEAN NOT NULL DEFAULT FALSE,
  broker_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CONTACTS (Leads/Clients)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'new', -- new, contacted, qualified, lost, won
  type TEXT DEFAULT 'lead', -- lead, client, owner
  assigned_to UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  property_id UUID REFERENCES properties(id),
  contact_id UUID REFERENCES contacts(id),
  broker_id UUID REFERENCES profiles(id),
  date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. PORTAL INTEGRATIONS
-- Stores non-sensitive integration state/config per organization.
-- Secrets (API keys, passwords) must not be stored here.
-- Note: the feed token is a public access token used for portal pulls; treat it as secret-like.
CREATE TABLE IF NOT EXISTS portal_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  portal TEXT NOT NULL CHECK (portal IN ('zap_vivareal', 'olx', 'imovelweb')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'attention', 'error')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, portal)
);

CREATE INDEX IF NOT EXISTS idx_portal_integrations_org ON portal_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_portal_integrations_portal ON portal_integrations(portal);

-- 7. PORTAL INTEGRATION RUNS
-- Each row represents an execution (test feed / sync) for a portal integration.
CREATE TABLE IF NOT EXISTS portal_integration_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  portal TEXT NOT NULL CHECK (portal IN ('zap_vivareal', 'olx', 'imovelweb')),
  kind TEXT NOT NULL DEFAULT 'test_feed' CHECK (kind IN ('test_feed', 'sync')),
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  properties_count INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_integration_runs_org ON portal_integration_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_portal_integration_runs_portal ON portal_integration_runs(portal);
CREATE INDEX IF NOT EXISTS idx_portal_integration_runs_created ON portal_integration_runs(created_at);

-- 8. PORTAL INTEGRATION ISSUES (base for "pendências humanas")
CREATE TABLE IF NOT EXISTS portal_integration_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  portal TEXT NOT NULL CHECK (portal IN ('zap_vivareal', 'olx', 'imovelweb')),
  property_id UUID REFERENCES properties(id),
  severity TEXT NOT NULL DEFAULT 'blocker' CHECK (severity IN ('blocker', 'warning')),
  issue_key TEXT NOT NULL,
  message_human TEXT NOT NULL,
  message_technical TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_portal_integration_issues_org ON portal_integration_issues(organization_id);
CREATE INDEX IF NOT EXISTS idx_portal_integration_issues_portal ON portal_integration_issues(portal);
CREATE INDEX IF NOT EXISTS idx_portal_integration_issues_property ON portal_integration_issues(property_id);

-- 9. SITE SETTINGS
-- Stores website configuration per organization (theme, brand, contact, colors).
CREATE TABLE IF NOT EXISTS site_settings (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'search_first' CHECK (theme IN ('search_first', 'premium')),
  brand_name TEXT,
  logo_url TEXT,
  logo_path TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  whatsapp TEXT,
  phone TEXT,
  email TEXT,
  ga4_measurement_id TEXT,
  meta_pixel_id TEXT,
  google_site_verification TEXT,
  facebook_domain_verification TEXT,
  google_ads_conversion_id TEXT,
  google_ads_conversion_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_settings_org ON site_settings(organization_id);

-- 10. SITE PAGES (institutional)
-- Simple CMS for institutional pages (about, contact, lgpd).
CREATE TABLE IF NOT EXISTS site_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  key TEXT NOT NULL CHECK (key IN ('about', 'contact', 'lgpd')),
  title TEXT,
  content TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_site_pages_org ON site_pages(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_pages_published ON site_pages(is_published);

-- 11. SITE BANNERS (popup, topbar, etc.)
CREATE TABLE IF NOT EXISTS site_banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  placement TEXT NOT NULL CHECK (placement IN ('popup', 'topbar', 'hero', 'footer')),
  variant TEXT NOT NULL DEFAULT 'compact' CHECK (variant IN ('compact', 'destaque')),
  title TEXT,
  body TEXT,
  image_url TEXT,
  image_path TEXT,
  link_url TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_banners_org ON site_banners(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_banners_active ON site_banners(is_active);
CREATE INDEX IF NOT EXISTS idx_site_banners_window ON site_banners(starts_at, ends_at);

-- 11b. CUSTOM DOMAINS (one per organization)
-- MVP: support only `www` domains; apex redirect handled by customer DNS/provider.
CREATE TABLE IF NOT EXISTS custom_domains (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'error')),
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);

-- 12. SITE NEWS
-- Lightweight blog-like content for SEO and authority.
CREATE TABLE IF NOT EXISTS site_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_site_news_org ON site_news(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_news_org_published ON site_news(organization_id, is_published);
CREATE INDEX IF NOT EXISTS idx_site_news_org_published_at ON site_news(organization_id, published_at DESC, created_at DESC);

-- 13. SITE LINKS
-- Useful external links shown in public site.
CREATE TABLE IF NOT EXISTS site_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_links_org ON site_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_site_links_org_published ON site_links(organization_id, is_published);
CREATE INDEX IF NOT EXISTS idx_site_links_org_order ON site_links(organization_id, sort_order ASC, created_at DESC);

-- 14. WEBHOOK ENDPOINTS (public ingest)
-- Token-authenticated endpoints to ingest leads into the CRM.
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  source TEXT NOT NULL CHECK (source IN ('site', 'portal_zap', 'portal_olx', 'portal_imovelweb', 'email_capture')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints(is_active);

-- 15. CONTACT EVENTS (timeline)
CREATE TABLE IF NOT EXISTS contact_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('lead_received', 'note_added')),
  source TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. MESSAGES (inbound/outbound)
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  channel TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public feed access (token-gated) via SECURITY DEFINER function.
-- This enables portals to pull XML feeds without requiring user auth.
CREATE OR REPLACE FUNCTION public.feed_properties(p_portal text, p_feed_token text)
RETURNS SETOF public.properties
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM portal_integrations i
  JOIN properties p ON p.organization_id = i.organization_id
  WHERE i.portal = p_portal
    AND i.status = 'active'
    AND (i.config->>'feed_token') = p_feed_token
    AND COALESCE((i.config->>'export_enabled')::boolean, false) IS TRUE
    -- MVP decision: the same "published" flag powers both Site and Portals.
    -- If it's hidden from the public site, it must not be exported to portals either.
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

-- PUBLIC SITE RPCs (SECURITY DEFINER)
-- Note: do not grant direct SELECT on internal tables to anon; use these RPCs instead.

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
        -- Safe address: omit street/number/zip.
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

CREATE OR REPLACE FUNCTION public.site_create_lead(
  p_site_slug text,
  p_property_id uuid DEFAULT NULL,
  p_name text,
  p_phone text,
  p_message text DEFAULT NULL,
  p_source_domain text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_now timestamptz := now();
  v_name text;
  v_phone_raw text;
  v_phone_norm text;
  v_message text;
  v_source_domain text;
  v_prop_title text;
  v_contact_id uuid;
  v_existing_contact_id uuid;
  v_dedup_window interval := interval '10 minutes';
  v_message_inserted boolean := false;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE slug = p_site_slug
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_name := left(btrim(COALESCE(p_name, '')), 120);
  v_phone_raw := left(btrim(COALESCE(p_phone, '')), 80);
  v_phone_norm := left(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), 32);
  v_message := NULLIF(left(btrim(COALESCE(p_message, '')), 2000), '');
  v_source_domain := NULLIF(lower(left(btrim(COALESCE(p_source_domain, '')), 255)), '');

  IF length(v_name) = 0 OR length(v_phone_norm) = 0 THEN
    RAISE EXCEPTION 'name and phone are required' USING ERRCODE = '22023';
  END IF;

  IF p_property_id IS NOT NULL THEN
    SELECT p.title INTO v_prop_title
    FROM public.properties p
    WHERE p.id = p_property_id
      AND p.organization_id = v_org_id
    LIMIT 1;

    IF v_prop_title IS NULL THEN
      RAISE EXCEPTION 'invalid property' USING ERRCODE = '22023';
    END IF;

    v_prop_title := left(v_prop_title, 200);
  END IF;

  -- Serialize per org+phone to reduce duplicates under concurrency.
  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':' || v_phone_norm));

  -- Reuse contact by normalized phone (no time window).
  SELECT c.id INTO v_existing_contact_id
  FROM public.contacts c
  WHERE c.organization_id = v_org_id
    AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone_norm
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_existing_contact_id IS NOT NULL THEN
    UPDATE public.contacts
    SET updated_at = v_now
    WHERE id = v_existing_contact_id;

    v_contact_id := v_existing_contact_id;
  ELSE
    INSERT INTO public.contacts (
      organization_id,
      name,
      phone,
      status,
      type,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      v_org_id,
      v_name,
      v_phone_norm,
      'new',
      'lead',
      left(
        '[site ' || to_char(v_now, 'YYYY-MM-DD HH24:MI:SS') || '] ' ||
        CASE WHEN v_prop_title IS NOT NULL THEN 'Imovel: ' || v_prop_title || '. ' ELSE '' END ||
        COALESCE(v_message, ''),
        5000
      ),
      v_now,
      v_now
    )
    RETURNING id INTO v_contact_id;
  END IF;

  -- Inbox consistency: event + message.
  INSERT INTO public.contact_events (
    organization_id,
    contact_id,
    type,
    source,
    payload,
    created_at
  )
  VALUES (
    v_org_id,
    v_contact_id,
    'lead_received',
    'site',
    jsonb_build_object(
      'property_id', p_property_id,
      'site_slug', p_site_slug,
      'source_domain', v_source_domain,
      'raw_phone', v_phone_raw,
      'phone_normalized', v_phone_norm,
      'message_preview', left(COALESCE(v_message, ''), 140)
    ),
    v_now
  );

  IF v_message IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.organization_id = v_org_id
        AND m.contact_id = v_contact_id
        AND m.direction = 'in'
        AND m.channel = 'site_form'
        AND m.body = v_message
        AND m.created_at >= (v_now - v_dedup_window)
      LIMIT 1
    ) THEN
      INSERT INTO public.messages (
        organization_id,
        contact_id,
        direction,
        channel,
        body,
        created_at
      )
      VALUES (
        v_org_id,
        v_contact_id,
        'in',
        'site_form',
        v_message,
        v_now
      );
      v_message_inserted := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'contact_id', v_contact_id,
    'deduped', (v_existing_contact_id IS NOT NULL),
    'message_inserted', v_message_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.site_create_lead(text, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_create_lead(text, uuid, text, text, text, text) TO anon, authenticated;

-- PUBLIC WEBHOOK RPCs (SECURITY DEFINER)
-- Token-based ingest of inbound leads/messages without exposing tables to anon.

CREATE OR REPLACE FUNCTION public.webhook_ingest_lead(
  p_token text,
  p_source text,
  p_external_id text DEFAULT NULL,
  p_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_property_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_endpoint_source text;
  v_source text;
  v_now timestamptz := now();
  v_name text;
  v_phone_raw text;
  v_phone_norm text;
  v_email text;
  v_message text;
  v_contact_id uuid;
  v_existing_contact_id uuid;
  v_dedup_window interval := interval '10 minutes';
  v_message_inserted boolean := false;
  v_event_inserted boolean := false;
BEGIN
  -- Resolve org by token. Token must be active.
  SELECT we.organization_id, we.source
  INTO v_org_id, v_endpoint_source
  FROM public.webhook_endpoints we
  WHERE we.token = p_token
    AND we.is_active IS TRUE
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Optional safety: enforce declared source matches endpoint source.
  IF v_endpoint_source IS NOT NULL AND p_source IS NOT NULL AND v_endpoint_source <> p_source THEN
    RAISE EXCEPTION 'invalid source for token' USING ERRCODE = '22023';
  END IF;

  v_name := left(btrim(COALESCE(p_name, '')), 120);
  v_phone_raw := left(btrim(COALESCE(p_phone, '')), 80);
  v_phone_norm := left(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), 32);
  v_email := NULLIF(left(btrim(COALESCE(p_email, '')), 180), '');
  v_message := NULLIF(left(btrim(COALESCE(p_message, '')), 2000), '');

  IF length(v_name) = 0 OR length(v_phone_norm) = 0 THEN
    RAISE EXCEPTION 'name and phone are required' USING ERRCODE = '22023';
  END IF;

  v_source := COALESCE(p_source, v_endpoint_source, 'unknown');

  -- Serialize per org+phone to reduce duplicates under concurrency.
  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':' || v_phone_norm));

  -- Reuse contact by normalized phone.
  SELECT c.id INTO v_existing_contact_id
  FROM public.contacts c
  WHERE c.organization_id = v_org_id
    AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone_norm
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_existing_contact_id IS NOT NULL THEN
    v_contact_id := v_existing_contact_id;

    -- Keep lightweight last-activity hint in notes.
    UPDATE public.contacts
    SET updated_at = v_now
    WHERE id = v_contact_id;
  ELSE
    INSERT INTO public.contacts (
      organization_id,
      name,
      email,
      phone,
      status,
      type,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      v_org_id,
      v_name,
      v_email,
      v_phone_norm,
      'new',
      'lead',
      left('[webhook ' || COALESCE(p_source, 'unknown') || ' ' || to_char(v_now, 'YYYY-MM-DD HH24:MI:SS') || '] ' || COALESCE(v_message, ''), 5000),
      v_now,
      v_now
    )
    RETURNING id INTO v_contact_id;
  END IF;

  -- Dedupe by phone + source + external_id (if provided) within a small window.
  IF p_external_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.contact_events e
    WHERE e.organization_id = v_org_id
      AND e.contact_id = v_contact_id
      AND e.source = v_source
      AND (e.payload->>'external_id') = p_external_id
      AND e.created_at >= (v_now - v_dedup_window)
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object(
      'organization_id', v_org_id,
      'contact_id', v_contact_id,
      'event_inserted', false,
      'message_inserted', false,
      'deduped_by', 'external_id'
    );
  END IF;

  -- Write an event to the timeline.
  INSERT INTO public.contact_events (
    organization_id,
    contact_id,
    type,
    source,
    payload,
    created_at
  )
  VALUES (
    v_org_id,
    v_contact_id,
    'lead_received',
    v_source,
    jsonb_build_object(
      'external_id', p_external_id,
      'property_id', p_property_id,
      'email', v_email,
      'raw_name', v_name,
      'raw_phone', v_phone_raw,
      'phone_normalized', v_phone_norm,
      'message_preview', left(COALESCE(v_message, ''), 140)
    ),
    v_now
  );
  v_event_inserted := true;

  -- Insert inbound message (dedupe within window).
  IF v_message IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.organization_id = v_org_id
        AND m.contact_id = v_contact_id
        AND m.direction = 'in'
        AND m.channel = (CASE WHEN v_source = 'site' THEN 'site_form' ELSE 'portal' END)
        AND m.body = v_message
        AND m.created_at >= (v_now - v_dedup_window)
      LIMIT 1
    ) THEN
      INSERT INTO public.messages (
        organization_id,
        contact_id,
        direction,
        channel,
        body,
        created_at
      )
      VALUES (
        v_org_id,
        v_contact_id,
        'in',
        (CASE WHEN v_source = 'site' THEN 'site_form' ELSE 'portal' END),
        v_message,
        v_now
      );
      v_message_inserted := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_org_id,
    'contact_id', v_contact_id,
    'event_inserted', v_event_inserted,
    'message_inserted', v_message_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_ingest_lead(text, text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_ingest_lead(text, text, text, text, text, text, text, uuid) TO anon, authenticated;

-- Create webhook endpoint token for an org (panel helper).
CREATE OR REPLACE FUNCTION public.webhook_create_endpoint(p_org_id uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_token text;
  v_id uuid;
BEGIN
  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.organization_id = p_org_id
  LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Try a few times to avoid rare token collisions.
  FOR i IN 1..5 LOOP
    v_token := encode(gen_random_bytes(16), 'hex');
    BEGIN
      INSERT INTO public.webhook_endpoints (organization_id, token, source, is_active)
      VALUES (p_org_id, v_token, p_source, TRUE)
      RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- retry
    END;
  END LOOP;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'failed to create token' USING ERRCODE = '54000';
  END IF;

  RETURN jsonb_build_object('id', v_id, 'organization_id', p_org_id, 'source', p_source, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_create_endpoint(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_create_endpoint(uuid, text) TO authenticated;

-- RLS helper functions (avoid policy recursion by not querying RLS-protected tables directly)
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated;

-- RLS: Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_integration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE portal_integration_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Organizations
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own organization" ON organizations';
    EXECUTE 'CREATE POLICY "Users can view own organization" ON organizations FOR SELECT USING (id = public.current_user_org_id())';
END
$$;

-- Profiles
DO $$
BEGIN
    -- Important: avoid recursion. The old policy queried profiles inside the profiles policy.
    EXECUTE 'DROP POLICY IF EXISTS "Users can view profiles in same org" ON profiles';
    EXECUTE 'CREATE POLICY "Users can view profiles in same org" ON profiles FOR SELECT USING (organization_id = public.current_user_org_id())';
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON profiles
        FOR UPDATE USING (
            id = auth.uid()
        );
    END IF;
END
$$;

-- Properties
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View properties in same org" ON properties';
    EXECUTE 'CREATE POLICY "View properties in same org" ON properties FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Create properties if member of org" ON properties';
    EXECUTE 'CREATE POLICY "Create properties if member of org" ON properties FOR INSERT WITH CHECK (organization_id = public.current_user_org_id())';
    
    EXECUTE 'DROP POLICY IF EXISTS "Update properties granular" ON properties';
    EXECUTE 'CREATE POLICY "Update properties granular" ON properties FOR UPDATE USING (organization_id = public.current_user_org_id() AND (public.current_user_role() IN (''owner'', ''manager'') OR broker_id = auth.uid()))';

    -- RBAC: Owner/Manager Delete
    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can delete properties" ON properties';
    EXECUTE 'CREATE POLICY "Owners/Managers can delete properties" ON properties FOR DELETE USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Contacts
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View contacts in same org" ON contacts';
    EXECUTE 'CREATE POLICY "View contacts in same org" ON contacts FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Create contacts if member of org" ON contacts';
    EXECUTE 'CREATE POLICY "Create contacts if member of org" ON contacts FOR INSERT WITH CHECK (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Update contacts granular" ON contacts';
    EXECUTE 'CREATE POLICY "Update contacts granular" ON contacts FOR UPDATE USING (organization_id = public.current_user_org_id() AND (public.current_user_role() IN (''owner'', ''manager'') OR assigned_to = auth.uid()))';

    -- RBAC: Owner/Manager Delete
    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can delete contacts" ON contacts';
    EXECUTE 'CREATE POLICY "Owners/Managers can delete contacts" ON contacts FOR DELETE USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Appointments
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View appointments in same org" ON appointments';
    EXECUTE 'CREATE POLICY "View appointments in same org" ON appointments FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Create appointments if member of org" ON appointments';
    EXECUTE 'CREATE POLICY "Create appointments if member of org" ON appointments FOR INSERT WITH CHECK (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Update appointments granular" ON appointments';
    EXECUTE 'CREATE POLICY "Update appointments granular" ON appointments FOR UPDATE USING (organization_id = public.current_user_org_id() AND (public.current_user_role() IN (''owner'', ''manager'') OR broker_id = auth.uid()))';

    -- RBAC: Owner/Manager Delete (ADDED per User Request)
    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can delete appointments" ON appointments';
    EXECUTE 'CREATE POLICY "Owners/Managers can delete appointments" ON appointments FOR DELETE USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Site Settings
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View site settings in same org" ON site_settings';
    EXECUTE 'CREATE POLICY "View site settings in same org" ON site_settings FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage site settings" ON site_settings';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage site settings" ON site_settings FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Site Pages
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View site pages in same org" ON site_pages';
    EXECUTE 'CREATE POLICY "View site pages in same org" ON site_pages FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage site pages" ON site_pages';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage site pages" ON site_pages FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Site Banners
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View site banners in same org" ON site_banners';
    EXECUTE 'CREATE POLICY "View site banners in same org" ON site_banners FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage site banners" ON site_banners';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage site banners" ON site_banners FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Custom Domains
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View custom domains in same org" ON custom_domains';
    EXECUTE 'CREATE POLICY "View custom domains in same org" ON custom_domains FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage custom domains" ON custom_domains';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage custom domains" ON custom_domains FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Site News
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View site news in same org" ON site_news';
    EXECUTE 'CREATE POLICY "View site news in same org" ON site_news FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage site news" ON site_news';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage site news" ON site_news FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Site Links
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View site links in same org" ON site_links';
    EXECUTE 'CREATE POLICY "View site links in same org" ON site_links FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage site links" ON site_links';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage site links" ON site_links FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Webhook Endpoints
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View webhook endpoints in same org" ON webhook_endpoints';
    EXECUTE 'CREATE POLICY "View webhook endpoints in same org" ON webhook_endpoints FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage webhook endpoints" ON webhook_endpoints';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage webhook endpoints" ON webhook_endpoints FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Contact Events
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View contact events in same org" ON contact_events';
    EXECUTE 'CREATE POLICY "View contact events in same org" ON contact_events FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage contact events" ON contact_events';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage contact events" ON contact_events FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Messages
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View messages in same org" ON messages';
    EXECUTE 'CREATE POLICY "View messages in same org" ON messages FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage messages" ON messages';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage messages" ON messages FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Portal Integrations
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View portal integrations in same org" ON portal_integrations';
    EXECUTE 'CREATE POLICY "View portal integrations in same org" ON portal_integrations FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage portal integrations" ON portal_integrations';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage portal integrations" ON portal_integrations FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Portal Integration Runs
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View portal integration runs in same org" ON portal_integration_runs';
    EXECUTE 'CREATE POLICY "View portal integration runs in same org" ON portal_integration_runs FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can create portal integration runs" ON portal_integration_runs';
    EXECUTE 'CREATE POLICY "Owners/Managers can create portal integration runs" ON portal_integration_runs FOR INSERT WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Portal Integration Issues
DO $$
BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "View portal integration issues in same org" ON portal_integration_issues';
    EXECUTE 'CREATE POLICY "View portal integration issues in same org" ON portal_integration_issues FOR SELECT USING (organization_id = public.current_user_org_id())';

    EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage portal integration issues" ON portal_integration_issues';
    EXECUTE 'CREATE POLICY "Owners/Managers can manage portal integration issues" ON portal_integration_issues FOR ALL USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager'')) WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- TRIGGER: Handle New User
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- 1. Create a default Organization for the user
  INSERT INTO public.organizations (name, slug)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'organization_name', 'Minha Imobiliária'),
    gen_random_uuid()::text
  )
  RETURNING id INTO new_org_id;

  -- 2. Create the Profile linked to the user and organization
  INSERT INTO public.profiles (id, organization_id, full_name, role)
  VALUES (
    new.id,
    new_org_id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    'owner'
  );

  RETURN new;
END;
$$;

-- TRIGGER: On Auth User Created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- INDICES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(organization_id);
CREATE INDEX IF NOT EXISTS idx_properties_created ON properties(created_at);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_broker ON properties(broker_id);

CREATE INDEX IF NOT EXISTS idx_contacts_org ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned ON contacts(assigned_to);

CREATE INDEX IF NOT EXISTS idx_appointments_org ON appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_broker ON appointments(broker_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_property ON appointments(property_id);

CREATE INDEX IF NOT EXISTS idx_profiles_org ON profiles(organization_id);

CREATE INDEX IF NOT EXISTS idx_site_pages_org_created ON site_pages(organization_id, created_at);
CREATE INDEX IF NOT EXISTS idx_site_banners_org_created ON site_banners(organization_id, created_at);

-- Inbox / Webhooks
CREATE INDEX IF NOT EXISTS idx_contact_events_org_contact_created ON contact_events(organization_id, contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org_contact_created ON messages(organization_id, contact_id, created_at DESC);
-- Expression index to speed up dedupe by normalized phone.
CREATE INDEX IF NOT EXISTS idx_contacts_org_phone_norm
  ON contacts(organization_id, (regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')));

-- STORAGE CONFIGURATION
-- Create a storage bucket for properties
INSERT INTO storage.buckets (id, name, public) 
VALUES ('properties', 'properties', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- 1. Allow public read access to property images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access Properties'
    ) THEN
        CREATE POLICY "Public Access Properties"
        ON storage.objects FOR SELECT
        USING ( bucket_id = 'properties' );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated Upload Properties'
    ) THEN
        CREATE POLICY "Authenticated Upload Properties"
        ON storage.objects FOR INSERT
        WITH CHECK (
            bucket_id = 'properties' AND
            auth.role() = 'authenticated'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Owner Delete Properties'
    ) THEN
        CREATE POLICY "Owner Delete Properties"
        ON storage.objects FOR DELETE
        USING (
            bucket_id = 'properties' AND
            auth.uid() = owner
        );
    END IF;
END
$$;
