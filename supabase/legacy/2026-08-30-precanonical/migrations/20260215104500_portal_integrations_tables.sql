-- Portal integrations base tables + RLS (multi-tenant)
--
-- These tables are required for:
-- - /integrations/[portal] configuration (stores per-org config + feed token)
-- - /integrations/[portal]/report runs/issues
-- - public.feed_properties(...) (token-gated feed)
--
-- Assumes helper functions exist (created earlier in this repo):
-- - public.current_user_org_id()
-- - public.current_user_role()

-- 1) Tables (idempotent)
CREATE TABLE IF NOT EXISTS public.portal_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  portal TEXT NOT NULL CHECK (portal IN ('zap_vivareal', 'olx', 'imovelweb')),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('inactive', 'active', 'attention', 'error')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, portal)
);

CREATE INDEX IF NOT EXISTS idx_portal_integrations_org ON public.portal_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_portal_integrations_portal ON public.portal_integrations(portal);

CREATE TABLE IF NOT EXISTS public.portal_integration_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  portal TEXT NOT NULL CHECK (portal IN ('zap_vivareal', 'olx', 'imovelweb')),
  kind TEXT NOT NULL DEFAULT 'test_feed' CHECK (kind IN ('test_feed', 'sync')),
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  properties_count INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portal_integration_runs_org ON public.portal_integration_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_portal_integration_runs_portal ON public.portal_integration_runs(portal);
CREATE INDEX IF NOT EXISTS idx_portal_integration_runs_created ON public.portal_integration_runs(created_at);

CREATE TABLE IF NOT EXISTS public.portal_integration_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES public.organizations(id) NOT NULL,
  portal TEXT NOT NULL CHECK (portal IN ('zap_vivareal', 'olx', 'imovelweb')),
  property_id UUID REFERENCES public.properties(id),
  severity TEXT NOT NULL DEFAULT 'blocker' CHECK (severity IN ('blocker', 'warning')),
  issue_key TEXT NOT NULL,
  message_human TEXT NOT NULL,
  message_technical TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_portal_integration_issues_org ON public.portal_integration_issues(organization_id);
CREATE INDEX IF NOT EXISTS idx_portal_integration_issues_portal ON public.portal_integration_issues(portal);
CREATE INDEX IF NOT EXISTS idx_portal_integration_issues_property ON public.portal_integration_issues(property_id);

-- 2) RLS enablement (idempotent)
ALTER TABLE public.portal_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_integration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_integration_issues ENABLE ROW LEVEL SECURITY;

-- 3) Policies (idempotent drop/recreate)
DROP POLICY IF EXISTS "View portal integrations in same org" ON public.portal_integrations;
CREATE POLICY "View portal integrations in same org"
ON public.portal_integrations
FOR SELECT
TO authenticated
USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Owners/Managers can manage portal integrations" ON public.portal_integrations;
CREATE POLICY "Owners/Managers can manage portal integrations"
ON public.portal_integrations
FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND public.current_user_role() IN ('owner', 'manager')
)
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND public.current_user_role() IN ('owner', 'manager')
);

DROP POLICY IF EXISTS "View portal integration runs in same org" ON public.portal_integration_runs;
CREATE POLICY "View portal integration runs in same org"
ON public.portal_integration_runs
FOR SELECT
TO authenticated
USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Owners/Managers can create portal integration runs" ON public.portal_integration_runs;
CREATE POLICY "Owners/Managers can create portal integration runs"
ON public.portal_integration_runs
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND public.current_user_role() IN ('owner', 'manager')
);

DROP POLICY IF EXISTS "View portal integration issues in same org" ON public.portal_integration_issues;
CREATE POLICY "View portal integration issues in same org"
ON public.portal_integration_issues
FOR SELECT
TO authenticated
USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Owners/Managers can manage portal integration issues" ON public.portal_integration_issues;
CREATE POLICY "Owners/Managers can manage portal integration issues"
ON public.portal_integration_issues
FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND public.current_user_role() IN ('owner', 'manager')
)
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND public.current_user_role() IN ('owner', 'manager')
);

