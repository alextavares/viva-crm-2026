-- Sprint 3.1: metas individuais por tipo + visitas agendadas

ALTER TABLE IF EXISTS public.goal_settings
  ADD COLUMN IF NOT EXISTS metric_captacoes_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS metric_respostas_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS metric_visitas_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS target_visitas INTEGER NOT NULL DEFAULT 6 CHECK (target_visitas BETWEEN 0 AND 100000);

ALTER TABLE IF EXISTS public.goal_broker_overrides
  ADD COLUMN IF NOT EXISTS metric_captacoes_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS metric_respostas_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS metric_visitas_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS target_visitas INTEGER CHECK (target_visitas BETWEEN 0 AND 100000);

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
  v_global_target_visitas INTEGER := 6;
  v_global_sla INTEGER := 15;
  v_global_metric_cap_enabled BOOLEAN := TRUE;
  v_global_metric_resp_enabled BOOLEAN := TRUE;
  v_global_metric_visitas_enabled BOOLEAN := TRUE;

  v_override_enabled BOOLEAN;
  v_override_period TEXT;
  v_override_target_cap INTEGER;
  v_override_target_resp INTEGER;
  v_override_target_visitas INTEGER;
  v_override_sla INTEGER;
  v_override_metric_cap_enabled BOOLEAN;
  v_override_metric_resp_enabled BOOLEAN;
  v_override_metric_visitas_enabled BOOLEAN;

  v_effective_enabled BOOLEAN := TRUE;
  v_effective_period TEXT := 'weekly';
  v_effective_target_cap INTEGER := 4;
  v_effective_target_resp INTEGER := 20;
  v_effective_target_visitas INTEGER := 6;
  v_effective_sla INTEGER := 15;
  v_effective_metric_cap_enabled BOOLEAN := TRUE;
  v_effective_metric_resp_enabled BOOLEAN := TRUE;
  v_effective_metric_visitas_enabled BOOLEAN := TRUE;

  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_cap INTEGER := 0;
  v_resp INTEGER := 0;
  v_visitas INTEGER := 0;
  v_cap_pct INTEGER := 0;
  v_resp_pct INTEGER := 0;
  v_visitas_pct INTEGER := 0;
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
    gs.target_visitas,
    gs.response_sla_minutes,
    gs.metric_captacoes_enabled,
    gs.metric_respostas_enabled,
    gs.metric_visitas_enabled
  INTO
    v_global_enabled,
    v_global_period,
    v_global_target_cap,
    v_global_target_resp,
    v_global_target_visitas,
    v_global_sla,
    v_global_metric_cap_enabled,
    v_global_metric_resp_enabled,
    v_global_metric_visitas_enabled
  FROM public.goal_settings gs
  WHERE gs.organization_id = v_org_id
  LIMIT 1;

  SELECT
    o.enabled,
    o.period_type,
    o.target_captacoes,
    o.target_respostas,
    o.target_visitas,
    o.response_sla_minutes,
    o.metric_captacoes_enabled,
    o.metric_respostas_enabled,
    o.metric_visitas_enabled
  INTO
    v_override_enabled,
    v_override_period,
    v_override_target_cap,
    v_override_target_resp,
    v_override_target_visitas,
    v_override_sla,
    v_override_metric_cap_enabled,
    v_override_metric_resp_enabled,
    v_override_metric_visitas_enabled
  FROM public.goal_broker_overrides o
  WHERE o.organization_id = v_org_id
    AND o.profile_id = v_profile_id
  LIMIT 1;

  v_effective_enabled := COALESCE(v_override_enabled, v_global_enabled, TRUE);
  v_effective_period := COALESCE(v_override_period, v_global_period, 'weekly');
  v_effective_target_cap := COALESCE(v_override_target_cap, v_global_target_cap, 4);
  v_effective_target_resp := COALESCE(v_override_target_resp, v_global_target_resp, 20);
  v_effective_target_visitas := COALESCE(v_override_target_visitas, v_global_target_visitas, 6);
  v_effective_sla := COALESCE(v_override_sla, v_global_sla, 15);

  IF v_effective_enabled IS TRUE THEN
    v_effective_metric_cap_enabled := COALESCE(v_override_metric_cap_enabled, v_global_metric_cap_enabled, TRUE);
    v_effective_metric_resp_enabled := COALESCE(v_override_metric_resp_enabled, v_global_metric_resp_enabled, TRUE);
    v_effective_metric_visitas_enabled := COALESCE(v_override_metric_visitas_enabled, v_global_metric_visitas_enabled, TRUE);
  ELSE
    v_effective_metric_cap_enabled := FALSE;
    v_effective_metric_resp_enabled := FALSE;
    v_effective_metric_visitas_enabled := FALSE;
  END IF;

  IF v_effective_period = 'monthly' THEN
    v_window_start := date_trunc('month', NOW());
    v_window_end := date_trunc('month', NOW()) + INTERVAL '1 month';
  ELSE
    v_window_start := date_trunc('week', NOW());
    v_window_end := date_trunc('week', NOW()) + INTERVAL '1 week';
  END IF;

  IF v_effective_metric_cap_enabled THEN
    SELECT COUNT(*)::INTEGER
    INTO v_cap
    FROM public.properties p
    WHERE p.organization_id = v_org_id
      AND p.broker_id = v_profile_id
      AND p.created_at >= v_window_start
      AND p.created_at < v_window_end;
  END IF;

  IF v_effective_metric_resp_enabled THEN
    SELECT COUNT(*)::INTEGER
    INTO v_resp
    FROM public.lead_response_metrics m
    WHERE m.organization_id = v_org_id
      AND m.responder_profile_id = v_profile_id
      AND m.is_within_sla IS TRUE
      AND m.first_response_at >= v_window_start
      AND m.first_response_at < v_window_end;
  END IF;

  IF v_effective_metric_visitas_enabled THEN
    SELECT COUNT(*)::INTEGER
    INTO v_visitas
    FROM public.appointments a
    WHERE a.organization_id = v_org_id
      AND a.broker_id = v_profile_id
      AND COALESCE(a.status, 'scheduled') IN ('scheduled', 'completed', 'no_show')
      AND a.date >= v_window_start
      AND a.date < v_window_end;
  END IF;

  IF v_effective_metric_cap_enabled AND v_effective_target_cap > 0 THEN
    v_cap_pct := LEAST(100, ((v_cap * 100) / v_effective_target_cap));
  END IF;

  IF v_effective_metric_resp_enabled AND v_effective_target_resp > 0 THEN
    v_resp_pct := LEAST(100, ((v_resp * 100) / v_effective_target_resp));
  END IF;

  IF v_effective_metric_visitas_enabled AND v_effective_target_visitas > 0 THEN
    v_visitas_pct := LEAST(100, ((v_visitas * 100) / v_effective_target_visitas));
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
    'metric_captacoes_enabled', v_effective_metric_cap_enabled,
    'metric_respostas_enabled', v_effective_metric_resp_enabled,
    'metric_visitas_enabled', v_effective_metric_visitas_enabled,
    'target_captacoes', v_effective_target_cap,
    'target_respostas', v_effective_target_resp,
    'target_visitas', v_effective_target_visitas,
    'current_captacoes', v_cap,
    'current_respostas', v_resp,
    'current_visitas', v_visitas,
    'progress_captacoes_pct', v_cap_pct,
    'progress_respostas_pct', v_resp_pct,
    'progress_visitas_pct', v_visitas_pct
  );
END;
$$;

REVOKE ALL ON FUNCTION public.goals_dashboard_snapshot(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.goals_dashboard_snapshot(UUID, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
