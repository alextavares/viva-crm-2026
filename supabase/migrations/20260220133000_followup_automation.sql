-- Follow-up automation (Sprint 1)
-- - Per-organization follow-up settings
-- - Follow-up job queue
-- - Automatic scheduling on inbound lead events
-- - Processor RPC for due jobs

CREATE TABLE IF NOT EXISTS public.followup_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  step_5m_template TEXT NOT NULL DEFAULT 'Olá {{first_name}}, vi seu interesse e posso te ajudar agora. Posso te chamar no WhatsApp?',
  step_24h_template TEXT NOT NULL DEFAULT 'Oi {{first_name}}, passando para saber se você quer avançar com os imóveis que combinam com seu perfil.',
  step_3d_template TEXT NOT NULL DEFAULT 'Olá {{first_name}}, ainda tenho opções boas para você. Quer que eu te envie uma seleção atualizada?',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.followup_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('5m', '24h', '3d')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'paused', 'canceled')),
  source TEXT NOT NULL DEFAULT 'lead_received',
  template_body TEXT NOT NULL DEFAULT '',
  scheduled_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, contact_id, step, scheduled_at)
);

CREATE INDEX IF NOT EXISTS idx_followup_jobs_due
  ON public.followup_jobs (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_followup_jobs_org_contact
  ON public.followup_jobs (organization_id, contact_id, scheduled_at DESC);

ALTER TABLE public.followup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View followup settings in same org" ON followup_settings';
  EXECUTE 'CREATE POLICY "View followup settings in same org" ON followup_settings
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage followup settings" ON followup_settings';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage followup settings" ON followup_settings
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View followup jobs in same org" ON followup_jobs';
  EXECUTE 'CREATE POLICY "View followup jobs in same org" ON followup_jobs
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage followup jobs" ON followup_jobs';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage followup jobs" ON followup_jobs
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

-- Extend contact_events type enum-like check to support follow-up timeline events.
DO $$
BEGIN
  ALTER TABLE public.contact_events DROP CONSTRAINT IF EXISTS contact_events_type_check;
  ALTER TABLE public.contact_events
    ADD CONSTRAINT contact_events_type_check
    CHECK (type IN ('lead_received', 'note_added', 'followup_sent'));
EXCEPTION
  WHEN undefined_table THEN
    -- Table might not exist in some environments yet.
    NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.followup_schedule_sequence(
  p_org_id UUID,
  p_contact_id UUID,
  p_start_at TIMESTAMPTZ DEFAULT NOW(),
  p_source TEXT DEFAULT 'lead_received'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.followup_settings%ROWTYPE;
  v_inserted INTEGER := 0;
  v_has_recent_sequence BOOLEAN := FALSE;
BEGIN
  IF p_org_id IS NULL OR p_contact_id IS NULL THEN
    RETURN jsonb_build_object('scheduled', FALSE, 'reason', 'missing_params');
  END IF;

  INSERT INTO public.followup_settings (organization_id)
  VALUES (p_org_id)
  ON CONFLICT (organization_id) DO NOTHING;

  SELECT *
  INTO v_settings
  FROM public.followup_settings
  WHERE organization_id = p_org_id
  LIMIT 1;

  IF COALESCE(v_settings.enabled, FALSE) IS NOT TRUE THEN
    RETURN jsonb_build_object('scheduled', FALSE, 'reason', 'disabled');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.followup_jobs j
    WHERE j.organization_id = p_org_id
      AND j.contact_id = p_contact_id
      AND j.status IN ('pending', 'sent')
      AND j.created_at >= (p_start_at - INTERVAL '6 hours')
  )
  INTO v_has_recent_sequence;

  IF v_has_recent_sequence THEN
    RETURN jsonb_build_object('scheduled', FALSE, 'reason', 'recent_sequence');
  END IF;

  INSERT INTO public.followup_jobs (
    organization_id, contact_id, step, status, source, template_body, scheduled_at
  )
  VALUES
    (p_org_id, p_contact_id, '5m', 'pending', COALESCE(NULLIF(p_source, ''), 'lead_received'), COALESCE(v_settings.step_5m_template, ''), p_start_at + INTERVAL '5 minutes'),
    (p_org_id, p_contact_id, '24h', 'pending', COALESCE(NULLIF(p_source, ''), 'lead_received'), COALESCE(v_settings.step_24h_template, ''), p_start_at + INTERVAL '24 hours'),
    (p_org_id, p_contact_id, '3d', 'pending', COALESCE(NULLIF(p_source, ''), 'lead_received'), COALESCE(v_settings.step_3d_template, ''), p_start_at + INTERVAL '3 days')
  ON CONFLICT (organization_id, contact_id, step, scheduled_at) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object('scheduled', v_inserted > 0, 'inserted', v_inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.followup_schedule_sequence(UUID, UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.followup_schedule_sequence(UUID, UUID, TIMESTAMPTZ, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.followup_schedule_on_lead_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'lead_received' THEN
    PERFORM public.followup_schedule_sequence(NEW.organization_id, NEW.contact_id, NEW.created_at, NEW.source);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_followup_schedule_on_lead_event ON public.contact_events;
CREATE TRIGGER trg_followup_schedule_on_lead_event
AFTER INSERT ON public.contact_events
FOR EACH ROW
EXECUTE FUNCTION public.followup_schedule_on_lead_event();

CREATE OR REPLACE FUNCTION public.followup_process_due(
  p_limit INTEGER DEFAULT 100,
  p_org_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job RECORD;
  v_name TEXT;
  v_phone TEXT;
  v_body TEXT;
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500);
  v_total INTEGER := 0;
  v_sent INTEGER := 0;
  v_failed INTEGER := 0;
BEGIN
  FOR v_job IN
    SELECT j.*
    FROM public.followup_jobs j
    WHERE j.status = 'pending'
      AND j.scheduled_at <= NOW()
      AND (p_org_id IS NULL OR j.organization_id = p_org_id)
    ORDER BY j.scheduled_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    v_total := v_total + 1;

    SELECT c.name, c.phone
    INTO v_name, v_phone
    FROM public.contacts c
    WHERE c.id = v_job.contact_id
      AND c.organization_id = v_job.organization_id
    LIMIT 1;

    IF COALESCE(BTRIM(v_phone), '') = '' THEN
      UPDATE public.followup_jobs
      SET status = 'failed',
          error = 'Contato sem telefone/WhatsApp',
          processed_at = NOW(),
          updated_at = NOW()
      WHERE id = v_job.id;

      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    v_body := COALESCE(v_job.template_body, '');
    IF BTRIM(v_body) = '' THEN
      v_body := 'Olá {{first_name}}, passando para continuar seu atendimento.';
    END IF;

    v_body := REPLACE(v_body, '{{name}}', COALESCE(v_name, ''));
    v_body := REPLACE(v_body, '{{first_name}}', SPLIT_PART(COALESCE(v_name, ''), ' ', 1));

    INSERT INTO public.messages (organization_id, contact_id, direction, channel, body)
    VALUES (v_job.organization_id, v_job.contact_id, 'out', 'followup_auto', v_body);

    INSERT INTO public.contact_events (organization_id, contact_id, type, source, payload)
    VALUES (
      v_job.organization_id,
      v_job.contact_id,
      'followup_sent',
      'followup_auto',
      jsonb_build_object('job_id', v_job.id, 'step', v_job.step)
    );

    UPDATE public.followup_jobs
    SET status = 'sent',
        error = NULL,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_job.id;

    v_sent := v_sent + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'processed', v_total,
    'sent', v_sent,
    'failed', v_failed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.followup_process_due(INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.followup_process_due(INTEGER, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

