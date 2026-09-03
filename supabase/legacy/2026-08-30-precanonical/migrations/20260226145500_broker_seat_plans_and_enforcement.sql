-- E5 Sprint 5 (S001/S002):
-- - Add seat-plan contract per organization.
-- - Enforce hard limit for active broker profiles.
-- - Introduce explicit profile active state for seat accounting.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_profiles_org_role_active
  ON public.profiles(organization_id, role, is_active);

CREATE TABLE IF NOT EXISTS public.broker_seat_plans (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  broker_seat_limit INTEGER NOT NULL CHECK (broker_seat_limit >= 0),
  billing_cycle_anchor TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  billing_cycle_interval TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle_interval IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.broker_seat_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View broker seat plans in same org" ON broker_seat_plans';
  EXECUTE 'CREATE POLICY "View broker seat plans in same org" ON broker_seat_plans
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage broker seat plans" ON broker_seat_plans';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage broker seat plans" ON broker_seat_plans
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Backfill existing organizations with a safe default:
-- at least current number of active brokers, minimum 1 seat.
INSERT INTO public.broker_seat_plans (
  organization_id,
  broker_seat_limit,
  billing_cycle_anchor,
  billing_cycle_interval,
  status,
  created_at,
  updated_at
)
SELECT
  o.id,
  GREATEST(1, COALESCE(p.active_brokers, 0)),
  COALESCE(o.created_at, NOW()),
  'monthly',
  'active',
  NOW(),
  NOW()
FROM public.organizations o
LEFT JOIN (
  SELECT organization_id, COUNT(*)::INT AS active_brokers
  FROM public.profiles
  WHERE role = 'broker'
    AND COALESCE(is_active, TRUE) IS TRUE
  GROUP BY organization_id
) p ON p.organization_id = o.id
ON CONFLICT (organization_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_default_broker_seat_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.broker_seat_plans (
    organization_id,
    broker_seat_limit,
    billing_cycle_anchor,
    billing_cycle_interval,
    status
  )
  VALUES (
    NEW.id,
    1,
    COALESCE(NEW.created_at, NOW()),
    'monthly',
    'active'
  )
  ON CONFLICT (organization_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_default_broker_seat_plan ON public.organizations;
CREATE TRIGGER trg_ensure_default_broker_seat_plan
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_default_broker_seat_plan();

CREATE OR REPLACE FUNCTION public.count_active_brokers(p_org_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM public.profiles p
  WHERE p.organization_id = p_org_id
    AND p.role = 'broker'
    AND COALESCE(p.is_active, TRUE) IS TRUE;
$$;

REVOKE ALL ON FUNCTION public.count_active_brokers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_active_brokers(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_broker_seat_capacity(
  p_org_id UUID,
  p_extra INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  SELECT broker_seat_limit
  INTO v_limit
  FROM public.broker_seat_plans
  WHERE organization_id = p_org_id
  LIMIT 1;

  v_limit := COALESCE(v_limit, 1);
  v_used := public.count_active_brokers(p_org_id);

  RETURN (v_used + GREATEST(0, COALESCE(p_extra, 0))) <= v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.check_broker_seat_capacity(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_broker_seat_capacity(UUID, INTEGER) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_broker_seat_usage(p_org_id UUID)
RETURNS TABLE(used INTEGER, seat_limit INTEGER, available INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  SELECT broker_seat_limit
  INTO v_limit
  FROM public.broker_seat_plans
  WHERE organization_id = p_org_id
  LIMIT 1;

  v_limit := COALESCE(v_limit, 1);
  v_used := public.count_active_brokers(p_org_id);

  RETURN QUERY
  SELECT v_used, v_limit, GREATEST(0, v_limit - v_used);
END;
$$;

REVOKE ALL ON FUNCTION public.get_broker_seat_usage(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_broker_seat_usage(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_broker_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
  v_check_required BOOLEAN := FALSE;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'broker' AND COALESCE(NEW.is_active, TRUE) IS TRUE THEN
    IF TG_OP = 'INSERT' THEN
      v_check_required := TRUE;
    ELSE
      v_check_required := (
        OLD.role IS DISTINCT FROM 'broker'
        OR COALESCE(OLD.is_active, TRUE) IS NOT TRUE
        OR OLD.organization_id IS DISTINCT FROM NEW.organization_id
      );
    END IF;

    IF v_check_required THEN
      IF NOT public.check_broker_seat_capacity(NEW.organization_id, 1) THEN
        SELECT used, seat_limit
        INTO v_used, v_limit
        FROM public.get_broker_seat_usage(NEW.organization_id);

        RAISE EXCEPTION 'Limite de corretores do plano atingido (%/%). Faça upgrade para adicionar mais corretores.', v_used, v_limit
          USING ERRCODE = 'P0001',
                DETAIL = 'broker_seat_limit_reached';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_broker_seat_limit ON public.profiles;
CREATE TRIGGER trg_enforce_broker_seat_limit
  BEFORE INSERT OR UPDATE OF organization_id, role, is_active ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_broker_seat_limit();
