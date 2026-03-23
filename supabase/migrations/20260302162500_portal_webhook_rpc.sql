-- Migration: Add portal_create_lead RPC to handle webhooks
-- Date: 2026-03-02

CREATE OR REPLACE FUNCTION public.portal_create_lead(
  p_site_slug text,
  p_source text,
  p_name text,
  p_phone text,
  p_email text DEFAULT NULL,
  p_property_id uuid DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_now timestamptz := now();
  v_name text;
  v_phone_raw text;
  v_phone_norm text;
  v_email text;
  v_message text;
  v_source text;
  v_prop_title text;
  v_contact_id uuid;
  v_existing_contact_id uuid;
  v_dedup_window interval := interval '10 minutes';
  v_message_inserted boolean := false;
BEGIN
  -- 1. Get Organization
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE slug = p_site_slug
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Clean inputs
  v_name := left(btrim(COALESCE(p_name, '')), 120);
  v_phone_raw := left(btrim(COALESCE(p_phone, '')), 80);
  v_phone_norm := left(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), 32);
  v_email := NULLIF(left(btrim(COALESCE(p_email, '')), 255), '');
  v_message := NULLIF(left(btrim(COALESCE(p_message, '')), 2000), '');
  v_source := left(btrim(COALESCE(p_source, 'portal')), 50);

  IF length(v_name) = 0 OR length(v_phone_norm) = 0 THEN
    RAISE EXCEPTION 'name and phone are required' USING ERRCODE = '22023';
  END IF;

  -- 3. Verify Property if provided
  IF p_property_id IS NOT NULL THEN
    SELECT p.title INTO v_prop_title
    FROM public.properties p
    WHERE p.id = p_property_id
      AND p.organization_id = v_org_id
    LIMIT 1;

    IF v_prop_title IS NULL THEN
      -- Optional: don't fail hard, just ignore invalid property, 
      -- or log it. For now, matching site_create_lead behavior:
      RAISE EXCEPTION 'invalid property' USING ERRCODE = '22023';
    END IF;

    v_prop_title := left(v_prop_title, 200);
  END IF;

  -- Serialize per org+phone to reduce duplicates under concurrency
  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':' || v_phone_norm));

  -- Reuse contact by normalized phone
  SELECT c.id INTO v_existing_contact_id
  FROM public.contacts c
  WHERE c.organization_id = v_org_id
    AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone_norm
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_existing_contact_id IS NOT NULL THEN
    UPDATE public.contacts
    SET 
      updated_at = v_now,
      email = COALESCE(email, v_email) -- Optionally update email if missing
    WHERE id = v_existing_contact_id;

    v_contact_id := v_existing_contact_id;
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
      left(
        '[' || v_source || ' ' || to_char(v_now, 'YYYY-MM-DD HH24:MI:SS') || '] ' ||
        CASE WHEN v_prop_title IS NOT NULL THEN 'Imovel: ' || v_prop_title || '. ' ELSE '' END ||
        COALESCE(v_message, ''),
        5000
      ),
      v_now,
      v_now
    )
    RETURNING id INTO v_contact_id;
  END IF;

  -- Contact Event
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
      'property_id', p_property_id,
      'raw_phone', v_phone_raw,
      'phone_normalized', v_phone_norm,
      'email', v_email,
      'message_preview', left(COALESCE(v_message, ''), 140)
    ),
    v_now
  );

  -- Insert Message
  IF v_message IS NOT NULL THEN
    -- Dedup message within 10 minutes
    IF NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.organization_id = v_org_id
        AND m.contact_id = v_contact_id
        AND m.direction = 'in'
        AND m.channel = v_source
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
        v_source,
        v_message,
        v_now
      );
      v_message_inserted := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'contact_id', v_contact_id,
    'deduped', (v_existing_contact_id IS NOT NULL),
    'message_inserted', v_message_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_create_lead(text, text, text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_create_lead(text, text, text, text, text, uuid, text) TO anon, authenticated;
