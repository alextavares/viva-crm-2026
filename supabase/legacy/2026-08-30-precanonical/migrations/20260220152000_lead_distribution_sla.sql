-- Sprint 2: lead distribution + SLA
-- Round-robin only for brokers (option 1)

CREATE TABLE IF NOT EXISTS public.lead_distribution_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  mode TEXT NOT NULL DEFAULT 'round_robin' CHECK (mode IN ('round_robin')),
  sla_minutes INTEGER NOT NULL DEFAULT 15 CHECK (sla_minutes BETWEEN 1 AND 1440),
  redistribute_overdue BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_distribution_state (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  last_assigned_profile_id UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_distribution_state_last_assigned
  ON public.lead_distribution_state(last_assigned_profile_id);

ALTER TABLE public.lead_distribution_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_distribution_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View lead distribution settings in same org" ON lead_distribution_settings';
  EXECUTE 'CREATE POLICY "View lead distribution settings in same org" ON lead_distribution_settings
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage lead distribution settings" ON lead_distribution_settings';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage lead distribution settings" ON lead_distribution_settings
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View lead distribution state in same org" ON lead_distribution_state';
  EXECUTE 'CREATE POLICY "View lead distribution state in same org" ON lead_distribution_state
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage lead distribution state" ON lead_distribution_state';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage lead distribution state" ON lead_distribution_state
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

CREATE OR REPLACE FUNCTION public.lead_assign_next_broker(
  p_org_id UUID,
  p_contact_id UUID,
  p_reason TEXT DEFAULT 'lead_received',
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.lead_distribution_settings%ROWTYPE;
  v_contact_type TEXT;
  v_existing_assigned UUID;
  v_previous_assigned UUID;
  v_last_assigned UUID;
  v_brokers UUID[];
  v_next_assigned UUID;
  v_idx INTEGER;
  v_count INTEGER;
BEGIN
  IF p_org_id IS NULL OR p_contact_id IS NULL THEN
    RETURN jsonb_build_object('assigned', FALSE, 'reason', 'missing_params');
  END IF;

  SELECT c.type, c.assigned_to
  INTO v_contact_type, v_existing_assigned
  FROM public.contacts c
  WHERE c.organization_id = p_org_id
    AND c.id = p_contact_id
  LIMIT 1;

  IF v_contact_type IS NULL THEN
    RETURN jsonb_build_object('assigned', FALSE, 'reason', 'contact_not_found');
  END IF;

  IF v_contact_type <> 'lead' THEN
    RETURN jsonb_build_object('assigned', FALSE, 'reason', 'not_lead');
  END IF;

  IF v_existing_assigned IS NOT NULL AND p_force IS NOT TRUE THEN
    RETURN jsonb_build_object('assigned', FALSE, 'reason', 'already_assigned', 'assigned_to', v_existing_assigned);
  END IF;

  INSERT INTO public.lead_distribution_settings (organization_id)
  VALUES (p_org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT *
  INTO v_settings
  FROM public.lead_distribution_settings
  WHERE organization_id = p_org_id
  LIMIT 1;

  IF COALESCE(v_settings.enabled, TRUE) IS NOT TRUE THEN
    RETURN jsonb_build_object('assigned', FALSE, 'reason', 'distribution_disabled');
  END IF;

  SELECT array_agg(p.id ORDER BY p.created_at, p.id)
  INTO v_brokers
  FROM public.profiles p
  WHERE p.organization_id = p_org_id
    AND p.role = 'broker';

  v_count := COALESCE(array_length(v_brokers, 1), 0);
  IF v_count = 0 THEN
    RETURN jsonb_build_object('assigned', FALSE, 'reason', 'no_broker_available');
  END IF;

  IF p_force IS TRUE AND v_count = 1 AND v_existing_assigned IS NOT NULL THEN
    RETURN jsonb_build_object('assigned', FALSE, 'reason', 'no_alternative_broker');
  END IF;

  INSERT INTO public.lead_distribution_state (organization_id)
  VALUES (p_org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT last_assigned_profile_id
  INTO v_last_assigned
  FROM public.lead_distribution_state
  WHERE organization_id = p_org_id
  FOR UPDATE;

  IF p_force IS TRUE THEN
    v_last_assigned := COALESCE(v_existing_assigned, v_last_assigned);
  END IF;

  v_idx := array_position(v_brokers, v_last_assigned);
  IF v_idx IS NULL THEN
    v_next_assigned := v_brokers[1];
  ELSIF v_idx >= v_count THEN
    v_next_assigned := v_brokers[1];
  ELSE
    v_next_assigned := v_brokers[v_idx + 1];
  END IF;

  IF p_force IS TRUE AND v_existing_assigned IS NOT NULL AND v_next_assigned = v_existing_assigned AND v_count > 1 THEN
    v_idx := array_position(v_brokers, v_next_assigned);
    IF v_idx IS NULL OR v_idx >= v_count THEN
      v_next_assigned := v_brokers[1];
    ELSE
      v_next_assigned := v_brokers[v_idx + 1];
    END IF;
  END IF;

  v_previous_assigned := v_existing_assigned;

  UPDATE public.contacts c
  SET assigned_to = v_next_assigned,
      updated_at = NOW()
  WHERE c.organization_id = p_org_id
    AND c.id = p_contact_id
    AND (c.assigned_to IS NULL OR p_force IS TRUE);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('assigned', FALSE, 'reason', 'race_condition');
  END IF;

  UPDATE public.lead_distribution_state
  SET last_assigned_profile_id = v_next_assigned,
      updated_at = NOW()
  WHERE organization_id = p_org_id;

  INSERT INTO public.contact_events (organization_id, contact_id, type, source, payload)
  VALUES (
    p_org_id,
    p_contact_id,
    'note_added',
    'lead_distribution',
    jsonb_build_object(
      'action', CASE WHEN p_force THEN 'reassigned' ELSE 'assigned' END,
      'reason', COALESCE(NULLIF(p_reason, ''), 'lead_received'),
      'mode', 'round_robin',
      'assigned_to', v_next_assigned,
      'previous_assigned_to', v_previous_assigned
    )
  );

  RETURN jsonb_build_object(
    'assigned', TRUE,
    'assigned_to', v_next_assigned,
    'previous_assigned_to', v_previous_assigned,
    'mode', 'round_robin'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lead_assign_next_broker(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_assign_next_broker(UUID, UUID, TEXT, BOOLEAN) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.lead_assign_on_lead_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'lead_received' THEN
    PERFORM public.lead_assign_next_broker(NEW.organization_id, NEW.contact_id, NEW.source, FALSE);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_assign_on_lead_event ON public.contact_events;
CREATE TRIGGER trg_lead_assign_on_lead_event
AFTER INSERT ON public.contact_events
FOR EACH ROW
EXECUTE FUNCTION public.lead_assign_on_lead_event();

CREATE OR REPLACE FUNCTION public.lead_redistribute_overdue(
  p_limit INTEGER DEFAULT 50,
  p_org_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate RECORD;
  v_result JSONB;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500);
  v_checked INTEGER := 0;
  v_reassigned INTEGER := 0;
BEGIN
  FOR v_candidate IN
    SELECT
      c.organization_id,
      c.id AS contact_id
    FROM public.contacts c
    LEFT JOIN public.lead_distribution_settings s
      ON s.organization_id = c.organization_id
    JOIN LATERAL (
      SELECT MAX(e.created_at) AS last_lead_at
      FROM public.contact_events e
      WHERE e.organization_id = c.organization_id
        AND e.contact_id = c.id
        AND e.type = 'lead_received'
    ) lead_evt ON TRUE
    WHERE c.type = 'lead'
      AND c.status = 'new'
      AND c.assigned_to IS NOT NULL
      AND lead_evt.last_lead_at IS NOT NULL
      AND COALESCE(s.enabled, TRUE) IS TRUE
      AND COALESCE(s.redistribute_overdue, TRUE) IS TRUE
      AND NOW() > lead_evt.last_lead_at + make_interval(mins => GREATEST(COALESCE(s.sla_minutes, 15), 1))
      AND (p_org_id IS NULL OR c.organization_id = p_org_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.organization_id = c.organization_id
          AND m.contact_id = c.id
          AND m.direction = 'out'
          AND m.created_at >= lead_evt.last_lead_at
      )
    ORDER BY lead_evt.last_lead_at ASC
    LIMIT v_limit
  LOOP
    v_checked := v_checked + 1;
    SELECT public.lead_assign_next_broker(v_candidate.organization_id, v_candidate.contact_id, 'sla_overdue', TRUE)
    INTO v_result;

    IF COALESCE((v_result ->> 'assigned')::BOOLEAN, FALSE) THEN
      v_reassigned := v_reassigned + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'checked', v_checked,
    'reassigned', v_reassigned
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lead_redistribute_overdue(INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lead_redistribute_overdue(INTEGER, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
