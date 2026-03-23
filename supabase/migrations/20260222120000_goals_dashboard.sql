-- Sprint 3: goals (captacao + resposta rapida) com custo O(1) por evento
-- - Global settings por organizacao
-- - Override opcional por corretor (broker)
-- - Metricas de primeira resposta (idempotentes)
-- - Snapshot RPC para dashboard

CREATE TABLE IF NOT EXISTS public.goal_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  period_type TEXT NOT NULL DEFAULT 'weekly' CHECK (period_type IN ('weekly', 'monthly')),
  response_sla_minutes INTEGER NOT NULL DEFAULT 15 CHECK (response_sla_minutes BETWEEN 1 AND 1440),
  target_captacoes INTEGER NOT NULL DEFAULT 4 CHECK (target_captacoes BETWEEN 0 AND 100000),
  target_respostas INTEGER NOT NULL DEFAULT 20 CHECK (target_respostas BETWEEN 0 AND 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.goal_broker_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  period_type TEXT CHECK (period_type IN ('weekly', 'monthly')),
  response_sla_minutes INTEGER CHECK (response_sla_minutes BETWEEN 1 AND 1440),
  target_captacoes INTEGER CHECK (target_captacoes BETWEEN 0 AND 100000),
  target_respostas INTEGER CHECK (target_respostas BETWEEN 0 AND 100000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.lead_response_metrics (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  lead_event_at TIMESTAMPTZ NOT NULL,
  first_response_at TIMESTAMPTZ NOT NULL,
  responder_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  response_kind TEXT NOT NULL CHECK (response_kind IN ('message_out', 'status_change')),
  sla_minutes INTEGER NOT NULL CHECK (sla_minutes BETWEEN 1 AND 1440),
  is_within_sla BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_broker_overrides_org_profile
  ON public.goal_broker_overrides(organization_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_lead_response_metrics_org_responder_time
  ON public.lead_response_metrics(organization_id, responder_profile_id, first_response_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_response_metrics_org_time
  ON public.lead_response_metrics(organization_id, first_response_at DESC);

ALTER TABLE public.goal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_broker_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_response_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View goal settings in same org" ON goal_settings';
  EXECUTE 'CREATE POLICY "View goal settings in same org" ON goal_settings
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage goal settings" ON goal_settings';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage goal settings" ON goal_settings
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View goal broker overrides in same org" ON goal_broker_overrides';
  EXECUTE 'CREATE POLICY "View goal broker overrides in same org" ON goal_broker_overrides
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage goal broker overrides" ON goal_broker_overrides';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage goal broker overrides" ON goal_broker_overrides
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View lead response metrics in same org" ON lead_response_metrics';
  EXECUTE 'CREATE POLICY "View lead response metrics in same org" ON lead_response_metrics
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage lead response metrics" ON lead_response_metrics';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage lead response metrics" ON lead_response_metrics
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

CREATE OR REPLACE FUNCTION public.goal_mark_first_response(
  p_org_id UUID,
  p_contact_id UUID,
  p_response_at TIMESTAMPTZ,
  p_response_kind TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_type TEXT;
  v_contact_created_at TIMESTAMPTZ;
  v_assigned_to UUID;
  v_lead_event_at TIMESTAMPTZ;
  v_sla INTEGER := 15;
  v_override_enabled BOOLEAN;
  v_override_sla INTEGER;
  v_within BOOLEAN := FALSE;
BEGIN
  IF p_org_id IS NULL OR p_contact_id IS NULL OR p_response_at IS NULL THEN
    RETURN jsonb_build_object('recorded', FALSE, 'reason', 'missing_params');
  END IF;

  SELECT c.type, c.created_at, c.assigned_to
  INTO v_contact_type, v_contact_created_at, v_assigned_to
  FROM public.contacts c
  WHERE c.organization_id = p_org_id
    AND c.id = p_contact_id
  LIMIT 1;

  IF v_contact_type IS NULL THEN
    RETURN jsonb_build_object('recorded', FALSE, 'reason', 'contact_not_found');
  END IF;

  IF v_contact_type <> 'lead' THEN
    RETURN jsonb_build_object('recorded', FALSE, 'reason', 'not_lead');
  END IF;

  SELECT e.created_at
  INTO v_lead_event_at
  FROM public.contact_events e
  WHERE e.organization_id = p_org_id
    AND e.contact_id = p_contact_id
    AND e.type = 'lead_received'
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF v_lead_event_at IS NULL THEN
    v_lead_event_at := v_contact_created_at;
  END IF;

  IF v_lead_event_at IS NULL THEN
    RETURN jsonb_build_object('recorded', FALSE, 'reason', 'missing_lead_time');
  END IF;

  IF p_response_at < v_lead_event_at THEN
    RETURN jsonb_build_object('recorded', FALSE, 'reason', 'response_before_lead');
  END IF;

  SELECT gs.response_sla_minutes
  INTO v_sla
  FROM public.goal_settings gs
  WHERE gs.organization_id = p_org_id
  LIMIT 1;

  IF v_sla IS NULL THEN
    v_sla := 15;
  END IF;

  IF v_assigned_to IS NOT NULL THEN
    SELECT o.enabled, o.response_sla_minutes
    INTO v_override_enabled, v_override_sla
    FROM public.goal_broker_overrides o
    WHERE o.organization_id = p_org_id
      AND o.profile_id = v_assigned_to
    LIMIT 1;

    IF COALESCE(v_override_enabled, TRUE) IS TRUE AND v_override_sla IS NOT NULL THEN
      v_sla := v_override_sla;
    END IF;
  END IF;

  v_sla := LEAST(GREATEST(v_sla, 1), 1440);
  v_within := p_response_at <= (v_lead_event_at + make_interval(mins => v_sla));

  INSERT INTO public.lead_response_metrics (
    organization_id,
    contact_id,
    lead_event_at,
    first_response_at,
    responder_profile_id,
    response_kind,
    sla_minutes,
    is_within_sla
  )
  VALUES (
    p_org_id,
    p_contact_id,
    v_lead_event_at,
    p_response_at,
    v_assigned_to,
    CASE WHEN p_response_kind IN ('message_out', 'status_change') THEN p_response_kind ELSE 'status_change' END,
    v_sla,
    v_within
  )
  ON CONFLICT (organization_id, contact_id) DO NOTHING;

  IF FOUND THEN
    RETURN jsonb_build_object('recorded', TRUE, 'is_within_sla', v_within, 'sla_minutes', v_sla);
  END IF;

  RETURN jsonb_build_object('recorded', FALSE, 'reason', 'already_recorded');
END;
$$;

REVOKE ALL ON FUNCTION public.goal_mark_first_response(UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.goal_mark_first_response(UUID, UUID, TIMESTAMPTZ, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.goal_on_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'out'
    AND NEW.contact_id IS NOT NULL
    AND NEW.organization_id IS NOT NULL
    AND COALESCE(NEW.channel, '') <> 'followup_auto'
  THEN
    PERFORM public.goal_mark_first_response(NEW.organization_id, NEW.contact_id, COALESCE(NEW.created_at, NOW()), 'message_out');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goal_on_message_insert ON public.messages;
CREATE TRIGGER trg_goal_on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.goal_on_message_insert();

CREATE OR REPLACE FUNCTION public.goal_on_contact_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'lead'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND COALESCE(OLD.status, 'new') = 'new'
    AND COALESCE(NEW.status, '') <> 'new'
  THEN
    PERFORM public.goal_mark_first_response(NEW.organization_id, NEW.id, NOW(), 'status_change');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_goal_on_contact_status_change ON public.contacts;
CREATE TRIGGER trg_goal_on_contact_status_change
AFTER UPDATE OF status ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.goal_on_contact_status_change();

CREATE OR REPLACE FUNCTION public.goals_dashboard_snapshot(
  p_org_id UUID DEFAULT NULL,
  p_profile_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_profile_id UUID;
  v_role TEXT;
  v_global_enabled BOOLEAN := TRUE;
  v_global_period TEXT := 'weekly';
  v_global_target_cap INTEGER := 4;
  v_global_target_resp INTEGER := 20;
  v_global_sla INTEGER := 15;

  v_override_enabled BOOLEAN;
  v_override_period TEXT;
  v_override_target_cap INTEGER;
  v_override_target_resp INTEGER;
  v_override_sla INTEGER;

  v_effective_enabled BOOLEAN := TRUE;
  v_effective_period TEXT := 'weekly';
  v_effective_target_cap INTEGER := 4;
  v_effective_target_resp INTEGER := 20;
  v_effective_sla INTEGER := 15;

  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_cap INTEGER := 0;
  v_resp INTEGER := 0;
  v_cap_pct INTEGER := 0;
  v_resp_pct INTEGER := 0;
BEGIN
  v_org_id := COALESCE(p_org_id, public.current_user_org_id());
  v_profile_id := COALESCE(p_profile_id, auth.uid());

  IF v_org_id IS NULL OR v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'missing_context');
  END IF;

  SELECT role
  INTO v_role
  FROM public.profiles
  WHERE id = v_profile_id
    AND organization_id = v_org_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'profile_not_found');
  END IF;

  SELECT
    gs.enabled,
    gs.period_type,
    gs.target_captacoes,
    gs.target_respostas,
    gs.response_sla_minutes
  INTO
    v_global_enabled,
    v_global_period,
    v_global_target_cap,
    v_global_target_resp,
    v_global_sla
  FROM public.goal_settings gs
  WHERE gs.organization_id = v_org_id
  LIMIT 1;

  SELECT
    o.enabled,
    o.period_type,
    o.target_captacoes,
    o.target_respostas,
    o.response_sla_minutes
  INTO
    v_override_enabled,
    v_override_period,
    v_override_target_cap,
    v_override_target_resp,
    v_override_sla
  FROM public.goal_broker_overrides o
  WHERE o.organization_id = v_org_id
    AND o.profile_id = v_profile_id
  LIMIT 1;

  v_effective_enabled := COALESCE(v_override_enabled, v_global_enabled, TRUE);
  v_effective_period := COALESCE(v_override_period, v_global_period, 'weekly');
  v_effective_target_cap := COALESCE(v_override_target_cap, v_global_target_cap, 4);
  v_effective_target_resp := COALESCE(v_override_target_resp, v_global_target_resp, 20);
  v_effective_sla := COALESCE(v_override_sla, v_global_sla, 15);

  IF v_effective_period = 'monthly' THEN
    v_window_start := date_trunc('month', NOW());
    v_window_end := date_trunc('month', NOW()) + INTERVAL '1 month';
  ELSE
    v_window_start := date_trunc('week', NOW());
    v_window_end := date_trunc('week', NOW()) + INTERVAL '1 week';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_cap
  FROM public.properties p
  WHERE p.organization_id = v_org_id
    AND p.broker_id = v_profile_id
    AND p.created_at >= v_window_start
    AND p.created_at < v_window_end;

  SELECT COUNT(*)::INTEGER
  INTO v_resp
  FROM public.lead_response_metrics m
  WHERE m.organization_id = v_org_id
    AND m.responder_profile_id = v_profile_id
    AND m.is_within_sla IS TRUE
    AND m.first_response_at >= v_window_start
    AND m.first_response_at < v_window_end;

  IF v_effective_target_cap > 0 THEN
    v_cap_pct := LEAST(100, ((v_cap * 100) / v_effective_target_cap));
  END IF;

  IF v_effective_target_resp > 0 THEN
    v_resp_pct := LEAST(100, ((v_resp * 100) / v_effective_target_resp));
  END IF;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'organization_id', v_org_id,
    'profile_id', v_profile_id,
    'role', v_role,
    'enabled', v_effective_enabled,
    'period_type', v_effective_period,
    'window_start', v_window_start,
    'window_end', v_window_end,
    'response_sla_minutes', v_effective_sla,
    'target_captacoes', v_effective_target_cap,
    'target_respostas', v_effective_target_resp,
    'current_captacoes', v_cap,
    'current_respostas', v_resp,
    'progress_captacoes_pct', v_cap_pct,
    'progress_respostas_pct', v_resp_pct
  );
END;
$$;

REVOKE ALL ON FUNCTION public.goals_dashboard_snapshot(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.goals_dashboard_snapshot(UUID, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
