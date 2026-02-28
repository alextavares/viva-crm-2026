-- E5 Sprint 5 / PR-4 hardening:
-- Team and seat audit trail for operational actions.

CREATE TABLE IF NOT EXISTS public.team_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_audit_events_org_created
  ON public.team_audit_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_audit_events_action
  ON public.team_audit_events(action, created_at DESC);

ALTER TABLE public.team_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View team audit events in same org" ON team_audit_events';
  EXECUTE 'CREATE POLICY "View team audit events in same org" ON team_audit_events
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can insert team audit events" ON team_audit_events';
  EXECUTE 'CREATE POLICY "Owners/Managers can insert team audit events" ON team_audit_events
    FOR INSERT
    WITH CHECK (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN (''owner'', ''manager'')
    )';
END
$$;
