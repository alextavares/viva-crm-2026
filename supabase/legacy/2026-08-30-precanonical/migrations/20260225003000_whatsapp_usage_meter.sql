-- Sprint 4 / Story E003-S003
-- Medicao de consumo mensal do add-on WhatsApp por organizacao.

ALTER TABLE public.whatsapp_addon_pricing_settings
  ADD COLUMN IF NOT EXISTS billing_timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

CREATE TABLE IF NOT EXISTS public.whatsapp_usage_monthly (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start_date DATE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  consumed_count INTEGER NOT NULL DEFAULT 0 CHECK (consumed_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, period_start_date)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_usage_monthly_org_period
  ON public.whatsapp_usage_monthly(organization_id, period_start_date DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp_official',
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound')),
  units INTEGER NOT NULL DEFAULT 1 CHECK (units BETWEEN 1 AND 1000),
  period_start_date DATE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, event_key)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_usage_events_org_created
  ON public.whatsapp_usage_events(organization_id, created_at DESC);

ALTER TABLE public.whatsapp_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_usage_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View whatsapp usage monthly in same org" ON whatsapp_usage_monthly';
  EXECUTE 'CREATE POLICY "View whatsapp usage monthly in same org" ON whatsapp_usage_monthly
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage whatsapp usage monthly" ON whatsapp_usage_monthly';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage whatsapp usage monthly" ON whatsapp_usage_monthly
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View whatsapp usage events in same org" ON whatsapp_usage_events';
  EXECUTE 'CREATE POLICY "View whatsapp usage events in same org" ON whatsapp_usage_events
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage whatsapp usage events" ON whatsapp_usage_events';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage whatsapp usage events" ON whatsapp_usage_events
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_usage_period_start(
  p_timezone TEXT DEFAULT 'America/Sao_Paulo',
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT := COALESCE(NULLIF(trim(p_timezone), ''), 'America/Sao_Paulo');
  v_period_start DATE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_timezone) THEN
    v_timezone := 'America/Sao_Paulo';
  END IF;

  v_period_start := date_trunc('month', p_now AT TIME ZONE v_timezone)::DATE;
  RETURN v_period_start;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_usage_snapshot(
  p_organization_id UUID DEFAULT NULL,
  p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID := COALESCE(p_organization_id, public.current_user_org_id());
  v_timezone TEXT := 'America/Sao_Paulo';
  v_period_start DATE;
  v_period_end DATE;
  v_included_quota INTEGER := 0;
  v_consumed INTEGER := 0;
  v_balance INTEGER := 0;
  v_addon_enabled BOOLEAN := FALSE;
  v_usage_percent NUMERIC := 0;
  v_alert_level TEXT := 'ok';
BEGIN
  IF v_org_id IS NULL THEN
    RETURN jsonb_build_object(
      'organization_id', NULL,
      'addon_enabled', FALSE,
      'timezone', 'America/Sao_Paulo',
      'period_start', NULL,
      'period_end', NULL,
      'included_quota', 0,
      'consumed', 0,
      'balance', 0,
      'usage_percent', 0,
      'alert_level', 'disabled'
    );
  END IF;

  SELECT
    COALESCE(s.addon_enabled, FALSE),
    COALESCE(NULLIF(s.billing_timezone, ''), 'America/Sao_Paulo'),
    COALESCE(s.included_quota, 0)
  INTO v_addon_enabled, v_timezone, v_included_quota
  FROM public.whatsapp_addon_pricing_settings s
  WHERE s.organization_id = v_org_id;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_timezone) THEN
    v_timezone := 'America/Sao_Paulo';
  END IF;

  v_period_start := public.whatsapp_usage_period_start(v_timezone, p_now);
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  SELECT COALESCE(m.consumed_count, 0)
    INTO v_consumed
    FROM public.whatsapp_usage_monthly m
   WHERE m.organization_id = v_org_id
     AND m.period_start_date = v_period_start;

  v_balance := GREATEST(v_included_quota - v_consumed, 0);

  IF v_included_quota > 0 THEN
    v_usage_percent := ROUND((v_consumed::numeric / v_included_quota::numeric) * 100, 2);
  ELSE
    v_usage_percent := CASE WHEN v_consumed > 0 THEN 100 ELSE 0 END;
  END IF;

  IF NOT v_addon_enabled THEN
    v_alert_level := 'disabled';
  ELSIF v_usage_percent >= 100 THEN
    v_alert_level := 'limit';
  ELSIF v_usage_percent >= 80 THEN
    v_alert_level := 'warning';
  ELSE
    v_alert_level := 'ok';
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_org_id,
    'addon_enabled', v_addon_enabled,
    'timezone', v_timezone,
    'period_start', v_period_start,
    'period_end', v_period_end,
    'included_quota', v_included_quota,
    'consumed', v_consumed,
    'balance', v_balance,
    'usage_percent', v_usage_percent,
    'alert_level', v_alert_level
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_record_send_event(
  p_organization_id UUID,
  p_event_key TEXT,
  p_units INTEGER DEFAULT 1,
  p_event_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone TEXT := 'America/Sao_Paulo';
  v_period_start DATE;
  v_units INTEGER := LEAST(GREATEST(COALESCE(p_units, 1), 1), 1000);
  v_inserted BOOLEAN := FALSE;
  v_rows_affected BIGINT := 0;
  v_snapshot JSONB;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(NULLIF(trim(p_event_key), ''), '') = '' THEN
    RAISE EXCEPTION 'event_key is required' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(s.billing_timezone, ''), 'America/Sao_Paulo')
    INTO v_timezone
    FROM public.whatsapp_addon_pricing_settings s
   WHERE s.organization_id = p_organization_id;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = v_timezone) THEN
    v_timezone := 'America/Sao_Paulo';
  END IF;

  v_period_start := public.whatsapp_usage_period_start(v_timezone, p_event_at);

  INSERT INTO public.whatsapp_usage_events (
    organization_id,
    event_key,
    channel,
    direction,
    units,
    period_start_date,
    timezone,
    created_at
  )
  VALUES (
    p_organization_id,
    trim(p_event_key),
    'whatsapp_official',
    'outbound',
    v_units,
    v_period_start,
    v_timezone,
    COALESCE(p_event_at, NOW())
  )
  ON CONFLICT (organization_id, event_key) DO NOTHING;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  v_inserted := v_rows_affected > 0;

  IF v_inserted THEN
    INSERT INTO public.whatsapp_usage_monthly (
      organization_id,
      period_start_date,
      timezone,
      consumed_count,
      created_at,
      updated_at
    )
    VALUES (
      p_organization_id,
      v_period_start,
      v_timezone,
      v_units,
      NOW(),
      NOW()
    )
    ON CONFLICT (organization_id, period_start_date) DO UPDATE
      SET consumed_count = public.whatsapp_usage_monthly.consumed_count + EXCLUDED.consumed_count,
          timezone = EXCLUDED.timezone,
          updated_at = NOW();
  END IF;

  v_snapshot := public.whatsapp_usage_snapshot(p_organization_id, p_event_at);

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'organization_id', p_organization_id,
    'event_key', trim(p_event_key),
    'period_start', v_period_start,
    'snapshot', v_snapshot
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_usage_record_from_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.direction = 'out'
     AND COALESCE(NEW.channel, '') IN ('whatsapp_official', 'whatsapp', 'whatsapp_api') THEN
    PERFORM public.whatsapp_record_send_event(
      NEW.organization_id,
      'message:' || NEW.id::TEXT,
      1,
      COALESCE(NEW.created_at, NOW())
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_usage_on_message_insert ON public.messages;
CREATE TRIGGER trg_whatsapp_usage_on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.whatsapp_usage_record_from_message();

REVOKE ALL ON FUNCTION public.whatsapp_usage_period_start(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_usage_period_start(TEXT, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.whatsapp_usage_snapshot(UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_usage_snapshot(UUID, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.whatsapp_record_send_event(UUID, TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_record_send_event(UUID, TEXT, INTEGER, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.whatsapp_usage_record_from_message() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_usage_record_from_message() TO authenticated;

NOTIFY pgrst, 'reload schema';
