-- E3 S006: Tokenized webhook endpoints + lead ingestion RPCs for inbound WhatsApp providers.

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  source TEXT NOT NULL CHECK (source IN ('site', 'portal_zap', 'portal_olx', 'portal_imovelweb', 'email_capture')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON public.webhook_endpoints(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_active ON public.webhook_endpoints(is_active);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View webhook endpoints in same org" ON webhook_endpoints';
  EXECUTE 'CREATE POLICY "View webhook endpoints in same org" ON webhook_endpoints
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage webhook endpoints" ON webhook_endpoints';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage webhook endpoints" ON webhook_endpoints
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

CREATE OR REPLACE FUNCTION public.webhook_ingest_lead(
  p_token text,
  p_source text,
  p_name text,
  p_phone text,
  p_external_id text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_property_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_endpoint_source text;
  v_source text;
  v_now timestamptz := now();
  v_name text;
  v_phone_raw text;
  v_phone_norm text;
  v_email text;
  v_message text;
  v_contact_id uuid;
  v_existing_contact_id uuid;
  v_dedup_window interval := interval '10 minutes';
  v_message_inserted boolean := false;
  v_event_inserted boolean := false;
BEGIN
  SELECT we.organization_id, we.source
  INTO v_org_id, v_endpoint_source
  FROM public.webhook_endpoints we
  WHERE we.token = p_token
    AND we.is_active IS TRUE
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_endpoint_source IS NOT NULL AND p_source IS NOT NULL AND v_endpoint_source <> p_source THEN
    RAISE EXCEPTION 'invalid source for token' USING ERRCODE = '22023';
  END IF;

  v_name := left(btrim(COALESCE(p_name, '')), 120);
  v_phone_raw := left(btrim(COALESCE(p_phone, '')), 80);
  v_phone_norm := left(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), 32);
  v_email := NULLIF(left(btrim(COALESCE(p_email, '')), 180), '');
  v_message := NULLIF(left(btrim(COALESCE(p_message, '')), 2000), '');

  IF length(v_name) = 0 OR length(v_phone_norm) = 0 THEN
    RAISE EXCEPTION 'name and phone are required' USING ERRCODE = '22023';
  END IF;

  v_source := COALESCE(p_source, v_endpoint_source, 'unknown');

  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':' || v_phone_norm));

  SELECT c.id INTO v_existing_contact_id
  FROM public.contacts c
  WHERE c.organization_id = v_org_id
    AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone_norm
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_existing_contact_id IS NOT NULL THEN
    v_contact_id := v_existing_contact_id;

    UPDATE public.contacts
    SET updated_at = v_now
    WHERE id = v_contact_id;
  ELSE
    INSERT INTO public.contacts (
      organization_id,
      name,
      email,
      phone,
      status,
      type,
      notes,
      created_at,
      updated_at
    )
    VALUES (
      v_org_id,
      v_name,
      v_email,
      v_phone_norm,
      'new',
      'lead',
      left('[webhook ' || COALESCE(p_source, 'unknown') || ' ' || to_char(v_now, 'YYYY-MM-DD HH24:MI:SS') || '] ' || COALESCE(v_message, ''), 5000),
      v_now,
      v_now
    )
    RETURNING id INTO v_contact_id;
  END IF;

  IF p_external_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.contact_events e
    WHERE e.organization_id = v_org_id
      AND e.contact_id = v_contact_id
      AND e.source = v_source
      AND (e.payload->>'external_id') = p_external_id
      AND e.created_at >= (v_now - v_dedup_window)
    LIMIT 1
  ) THEN
    RETURN jsonb_build_object(
      'organization_id', v_org_id,
      'contact_id', v_contact_id,
      'event_inserted', false,
      'message_inserted', false,
      'deduped_by', 'external_id'
    );
  END IF;

  INSERT INTO public.contact_events (
    organization_id,
    contact_id,
    type,
    source,
    payload,
    created_at
  )
  VALUES (
    v_org_id,
    v_contact_id,
    'lead_received',
    v_source,
    jsonb_build_object(
      'external_id', p_external_id,
      'property_id', p_property_id,
      'email', v_email,
      'raw_name', v_name,
      'raw_phone', v_phone_raw,
      'phone_normalized', v_phone_norm,
      'message_preview', left(COALESCE(v_message, ''), 140)
    ),
    v_now
  );
  v_event_inserted := true;

  IF v_message IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.organization_id = v_org_id
        AND m.contact_id = v_contact_id
        AND m.direction = 'in'
        AND m.channel = (CASE WHEN v_source = 'site' THEN 'site_form' ELSE 'portal' END)
        AND m.body = v_message
        AND m.created_at >= (v_now - v_dedup_window)
      LIMIT 1
    ) THEN
      INSERT INTO public.messages (
        organization_id,
        contact_id,
        direction,
        channel,
        body,
        created_at
      )
      VALUES (
        v_org_id,
        v_contact_id,
        'in',
        (CASE WHEN v_source = 'site' THEN 'site_form' ELSE 'portal' END),
        v_message,
        v_now
      );
      v_message_inserted := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'organization_id', v_org_id,
    'contact_id', v_contact_id,
    'event_inserted', v_event_inserted,
    'message_inserted', v_message_inserted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.webhook_create_endpoint(p_org_id uuid, p_source text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_token text;
  v_id uuid;
BEGIN
  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.organization_id = p_org_id
  LIMIT 1;

  IF v_role IS NULL OR v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOR i IN 1..5 LOOP
    v_token := encode(gen_random_bytes(16), 'hex');
    BEGIN
      INSERT INTO public.webhook_endpoints (organization_id, token, source, is_active)
      VALUES (p_org_id, v_token, p_source, TRUE)
      RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;
  END LOOP;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'failed to generate unique token';
  END IF;

  RETURN jsonb_build_object('id', v_id, 'organization_id', p_org_id, 'source', p_source, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.webhook_ingest_lead(text, text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_ingest_lead(text, text, text, text, text, text, text, uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.webhook_create_endpoint(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_create_endpoint(uuid, text) TO authenticated;

