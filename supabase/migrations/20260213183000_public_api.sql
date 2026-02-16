-- Migration: public site + lead capture (canonical alignment)
-- Date: 2026-02-13
--
-- This migration exists to keep the Supabase DB aligned with the app expectations
-- in `supabase/schema.sql`.
--
-- It is idempotent and also fixes the case where `contact_events`/`messages` were
-- created without `organization_id` and where `site_*` RPCs were created with
-- incompatible signatures.

-- 1) RLS helper functions (idempotent)
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated;

-- 2) contact_events table (aligned)
CREATE TABLE IF NOT EXISTS public.contact_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  type text NOT NULL,
  source text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_events ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Backfill org_id from contacts when missing.
UPDATE public.contact_events e
SET organization_id = c.organization_id
FROM public.contacts c
WHERE e.organization_id IS NULL
  AND e.contact_id = c.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.contact_events WHERE organization_id IS NULL LIMIT 1) THEN
    -- Leave nullable if we cannot backfill. This indicates inconsistent data.
    NULL;
  ELSE
    ALTER TABLE public.contact_events ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.contact_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Events: isolamento por organização" ON public.contact_events;
DROP POLICY IF EXISTS "View contact events in same org" ON public.contact_events;
DROP POLICY IF EXISTS "Owners/Managers can manage contact events" ON public.contact_events;

CREATE POLICY "View contact events in same org"
ON public.contact_events
FOR SELECT
TO authenticated
USING (organization_id = public.current_user_org_id());

CREATE POLICY "Owners/Managers can manage contact events"
ON public.contact_events
FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND public.current_user_role() IN ('owner', 'manager')
)
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND public.current_user_role() IN ('owner', 'manager')
);

CREATE INDEX IF NOT EXISTS idx_contact_events_org_contact_created
  ON public.contact_events(organization_id, contact_id, created_at DESC);

-- 3) messages table (aligned)
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  channel text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Backfill org_id from contacts when missing.
UPDATE public.messages m
SET organization_id = c.organization_id
FROM public.contacts c
WHERE m.organization_id IS NULL
  AND m.contact_id = c.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.messages WHERE organization_id IS NULL LIMIT 1) THEN
    NULL;
  ELSE
    ALTER TABLE public.messages ALTER COLUMN organization_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Messages: own org" ON public.messages;
DROP POLICY IF EXISTS "View messages in same org" ON public.messages;
DROP POLICY IF EXISTS "Owners/Managers can manage messages" ON public.messages;

CREATE POLICY "View messages in same org"
ON public.messages
FOR SELECT
TO authenticated
USING (organization_id = public.current_user_org_id());

CREATE POLICY "Owners/Managers can manage messages"
ON public.messages
FOR ALL
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND public.current_user_role() IN ('owner', 'manager')
)
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND public.current_user_role() IN ('owner', 'manager')
);

CREATE INDEX IF NOT EXISTS idx_messages_org_contact_created
  ON public.messages(organization_id, contact_id, created_at DESC);

-- 4) Public site RPCs (canonical signatures)
CREATE OR REPLACE FUNCTION public.site_get_property(p_site_slug text, p_property_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (
    SELECT id, slug
    FROM public.organizations
    WHERE slug = p_site_slug
    LIMIT 1
  ),
  prop AS (
    SELECT p.*
    FROM public.properties p
    JOIN org ON org.id = p.organization_id
    WHERE p.id = p_property_id
      AND p.status = 'available'
      AND p.hide_from_site IS FALSE
    LIMIT 1
  )
  SELECT
    CASE
      WHEN (SELECT id FROM prop) IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', (SELECT id FROM prop),
        'title', (SELECT title FROM prop),
        'description', (SELECT description FROM prop),
        'price', (SELECT price FROM prop),
        'type', (SELECT type FROM prop),
        'features', (SELECT features FROM prop),
        'images', (SELECT images FROM prop),
        -- Safe address: omit street/number/zip.
        'address', jsonb_build_object(
          'city', (SELECT address->>'city' FROM prop),
          'state', (SELECT address->>'state' FROM prop),
          'neighborhood', (SELECT address->>'neighborhood' FROM prop)
        )
      )
    END;
$$;

REVOKE ALL ON FUNCTION public.site_get_property(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_get_property(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.site_create_lead(
  p_site_slug text,
  p_name text,
  p_phone text,
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
  v_message text;
  v_prop_title text;
  v_contact_id uuid;
  v_existing_contact_id uuid;
  v_dedup_window interval := interval '10 minutes';
  v_message_inserted boolean := false;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE slug = p_site_slug
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_name := left(btrim(COALESCE(p_name, '')), 120);
  v_phone_raw := left(btrim(COALESCE(p_phone, '')), 80);
  v_phone_norm := left(regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g'), 32);
  v_message := NULLIF(left(btrim(COALESCE(p_message, '')), 2000), '');

  IF length(v_name) = 0 OR length(v_phone_norm) = 0 THEN
    RAISE EXCEPTION 'name and phone are required' USING ERRCODE = '22023';
  END IF;

  IF p_property_id IS NOT NULL THEN
    SELECT p.title INTO v_prop_title
    FROM public.properties p
    WHERE p.id = p_property_id
      AND p.organization_id = v_org_id
    LIMIT 1;

    IF v_prop_title IS NULL THEN
      RAISE EXCEPTION 'invalid property' USING ERRCODE = '22023';
    END IF;

    v_prop_title := left(v_prop_title, 200);
  END IF;

  -- Serialize per org+phone to reduce duplicates under concurrency.
  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':' || v_phone_norm));

  -- Reuse contact by normalized phone (no time window).
  SELECT c.id INTO v_existing_contact_id
  FROM public.contacts c
  WHERE c.organization_id = v_org_id
    AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone_norm
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_existing_contact_id IS NOT NULL THEN
    UPDATE public.contacts
    SET updated_at = v_now
    WHERE id = v_existing_contact_id;

    v_contact_id := v_existing_contact_id;
  ELSE
    INSERT INTO public.contacts (
      organization_id,
      name,
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
      v_phone_norm,
      'new',
      'lead',
      left(
        '[site ' || to_char(v_now, 'YYYY-MM-DD HH24:MI:SS') || '] ' ||
        CASE WHEN v_prop_title IS NOT NULL THEN 'Imovel: ' || v_prop_title || '. ' ELSE '' END ||
        COALESCE(v_message, ''),
        5000
      ),
      v_now,
      v_now
    )
    RETURNING id INTO v_contact_id;
  END IF;

  -- Inbox consistency: event + message.
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
    'site',
    jsonb_build_object(
      'property_id', p_property_id,
      'raw_phone', v_phone_raw,
      'phone_normalized', v_phone_norm,
      'message_preview', left(COALESCE(v_message, ''), 140)
    ),
    v_now
  );

  IF v_message IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.organization_id = v_org_id
        AND m.contact_id = v_contact_id
        AND m.direction = 'in'
        AND m.channel = 'site_form'
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
        'site_form',
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

REVOKE ALL ON FUNCTION public.site_create_lead(text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.site_create_lead(text, text, text, uuid, text) TO anon, authenticated;
