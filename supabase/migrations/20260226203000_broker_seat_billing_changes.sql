-- E5 Sprint 6 (S004/S005):
-- Seat billing changes with immediate upgrade (proration) and scheduled downgrade.

CREATE TABLE IF NOT EXISTS public.broker_seat_plan_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('upgrade', 'downgrade')),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'applied', 'cancelled')),
  old_limit INTEGER NOT NULL CHECK (old_limit >= 0),
  new_limit INTEGER NOT NULL CHECK (new_limit >= 0),
  effective_at TIMESTAMPTZ NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'BRL',
  unit_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  prorated_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (prorated_amount_cents >= 0),
  proration_days_total INTEGER NOT NULL DEFAULT 0 CHECK (proration_days_total >= 0),
  proration_days_remaining INTEGER NOT NULL DEFAULT 0 CHECK (proration_days_remaining >= 0),
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broker_seat_plan_changes_org_created
  ON public.broker_seat_plan_changes(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_broker_seat_plan_changes_status_effective
  ON public.broker_seat_plan_changes(status, effective_at);

ALTER TABLE public.broker_seat_plan_changes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View broker seat plan changes in same org" ON broker_seat_plan_changes';
  EXECUTE 'CREATE POLICY "View broker seat plan changes in same org" ON broker_seat_plan_changes
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage broker seat plan changes" ON broker_seat_plan_changes';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage broker seat plan changes" ON broker_seat_plan_changes
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;
