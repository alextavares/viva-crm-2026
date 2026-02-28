-- Sprint 4 / Story E003-S004
-- Regras de envio oficial por plano/quota com fallback seguro.

DO $$
BEGIN
  ALTER TABLE public.contact_events DROP CONSTRAINT IF EXISTS contact_events_type_check;
  ALTER TABLE public.contact_events
    ADD CONSTRAINT contact_events_type_check
    CHECK (type IN ('lead_received', 'note_added', 'followup_sent', 'whatsapp_policy_blocked'));
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_send_policy_check(
  p_organization_id UUID,
  p_units INTEGER DEFAULT 1,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_addon_enabled BOOLEAN := FALSE;
  v_timezone TEXT := 'America/Sao_Paulo';
  v_included_quota INTEGER := 0;
  v_units INTEGER := LEAST(GREATEST(COALESCE(p_units, 1), 1), 500);
  v_period_start DATE;
  v_consumed INTEGER := 0;
  v_balance INTEGER := 0;
  v_reason TEXT := 'addon_disabled';
  v_allowed BOOLEAN := FALSE;
  v_message TEXT := 'Add-on WhatsApp desativado. Envio oficial bloqueado.';
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'missing_org',
      'message', 'Organização não informada.',
      'addon_enabled', FALSE,
      'included_quota', 0,
      'consumed_count', 0,
      'balance', 0
    );
  END IF;

  SELECT
    COALESCE(s.addon_enabled, FALSE),
    COALESCE(NULLIF(BTRIM(s.billing_timezone), ''), 'America/Sao_Paulo'),
    COALESCE(s.included_quota, 0)
  INTO v_addon_enabled, v_timezone, v_included_quota
  FROM public.whatsapp_addon_pricing_settings s
  WHERE s.organization_id = p_organization_id
  LIMIT 1;

  v_period_start := public.whatsapp_usage_period_start(v_timezone, p_now);

  SELECT COALESCE(m.consumed_count, 0)
  INTO v_consumed
  FROM public.whatsapp_usage_monthly m
  WHERE m.organization_id = p_organization_id
    AND m.period_start_date = v_period_start
  LIMIT 1;

  v_balance := GREATEST(v_included_quota - v_consumed, 0);

  IF v_addon_enabled IS NOT TRUE THEN
    v_reason := 'addon_disabled';
    v_allowed := FALSE;
    v_message := 'Add-on WhatsApp desativado. Envio oficial bloqueado.';
  ELSIF (v_consumed + v_units) > v_included_quota THEN
    v_reason := 'quota_exhausted';
    v_allowed := FALSE;
    v_message := 'Quota mensal do WhatsApp Oficial atingida. Envio oficial bloqueado.';
  ELSE
    v_reason := 'ok';
    v_allowed := TRUE;
    v_message := 'Envio oficial permitido.';
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'reason', v_reason,
    'message', v_message,
    'addon_enabled', v_addon_enabled,
    'billing_timezone', v_timezone,
    'period_start_date', v_period_start,
    'included_quota', v_included_quota,
    'consumed_count', v_consumed,
    'balance', v_balance,
    'requested_units', v_units
  );
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_send_policy_check(UUID, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_send_policy_check(UUID, INTEGER, TIMESTAMPTZ) TO authenticated;

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
  v_blocked INTEGER := 0;
  v_official_sent INTEGER := 0;
  v_channel_connected BOOLEAN := FALSE;
  v_channel TEXT := 'followup_auto';
  v_policy JSONB;
  v_policy_allowed BOOLEAN := FALSE;
  v_policy_reason TEXT := NULL;
  v_policy_message TEXT := NULL;
  v_job_error TEXT := NULL;
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

    v_channel := 'followup_auto';
    v_policy := NULL;
    v_policy_allowed := FALSE;
    v_policy_reason := NULL;
    v_policy_message := NULL;
    v_job_error := NULL;

    SELECT EXISTS (
      SELECT 1
      FROM public.whatsapp_channel_settings w
      WHERE w.organization_id = v_job.organization_id
        AND w.status = 'connected'
    )
    INTO v_channel_connected;

    IF v_channel_connected THEN
      v_policy := public.whatsapp_send_policy_check(v_job.organization_id, 1, NOW());
      v_policy_allowed := COALESCE((v_policy->>'allowed')::boolean, FALSE);
      v_policy_reason := NULLIF(BTRIM(COALESCE(v_policy->>'reason', '')), '');
      v_policy_message := NULLIF(BTRIM(COALESCE(v_policy->>'message', '')), '');

      IF v_policy_allowed THEN
        v_channel := 'whatsapp_official';
        v_official_sent := v_official_sent + 1;
      ELSE
        v_channel := 'followup_auto';
        v_job_error := COALESCE(
          v_policy_message,
          'Envio oficial bloqueado por política comercial. Follow-up enviado no modo padrão.'
        );
        v_blocked := v_blocked + 1;

        INSERT INTO public.contact_events (organization_id, contact_id, type, source, payload)
        VALUES (
          v_job.organization_id,
          v_job.contact_id,
          'whatsapp_policy_blocked',
          'whatsapp_policy',
          jsonb_build_object(
            'job_id', v_job.id,
            'step', v_job.step,
            'reason', COALESCE(v_policy_reason, 'blocked'),
            'message', COALESCE(v_job_error, 'Envio oficial bloqueado.'),
            'policy', COALESCE(v_policy, '{}'::jsonb)
          )
        );
      END IF;
    END IF;

    INSERT INTO public.messages (organization_id, contact_id, direction, channel, body)
    VALUES (v_job.organization_id, v_job.contact_id, 'out', v_channel, v_body);

    INSERT INTO public.contact_events (organization_id, contact_id, type, source, payload)
    VALUES (
      v_job.organization_id,
      v_job.contact_id,
      'followup_sent',
      'followup_auto',
      jsonb_build_object(
        'job_id', v_job.id,
        'step', v_job.step,
        'channel', v_channel,
        'official_blocked_reason', v_policy_reason
      )
    );

    UPDATE public.followup_jobs
    SET status = 'sent',
        error = v_job_error,
        processed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_job.id;

    v_sent := v_sent + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'processed', v_total,
    'sent', v_sent,
    'failed', v_failed,
    'blocked', v_blocked,
    'official_sent', v_official_sent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.followup_process_due(INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.followup_process_due(INTEGER, UUID) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
