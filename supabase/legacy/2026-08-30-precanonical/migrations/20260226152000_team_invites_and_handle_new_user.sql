-- E5 Sprint 5 / PR-2 foundation:
-- Team invites + signup hook aware of existing-organization invites.

CREATE TABLE IF NOT EXISTS public.team_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'broker' CHECK (role IN ('owner', 'manager', 'broker', 'assistant')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_invites_org_status
  ON public.team_invites(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_team_invites_email_status
  ON public.team_invites(lower(email), status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_invites_unique_pending_org_email
  ON public.team_invites(organization_id, lower(email))
  WHERE status = 'pending';

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View team invites in same org" ON team_invites';
  EXECUTE 'CREATE POLICY "View team invites in same org" ON team_invites
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage team invites" ON team_invites';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage team invites" ON team_invites
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  invite_row public.team_invites%ROWTYPE;
  resolved_name TEXT;
BEGIN
  resolved_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(COALESCE(new.email, ''), '@', 1), 'Novo Usuário');

  -- Prefer invited organization when a valid pending invite exists for the same email.
  SELECT *
  INTO invite_row
  FROM public.team_invites ti
  WHERE lower(ti.email) = lower(new.email)
    AND ti.status = 'pending'
    AND (ti.expires_at IS NULL OR ti.expires_at > NOW())
  ORDER BY ti.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF invite_row.id IS NOT NULL THEN
    INSERT INTO public.profiles (id, organization_id, full_name, role, is_active)
    VALUES (
      new.id,
      invite_row.organization_id,
      resolved_name,
      invite_row.role,
      TRUE
    )
    ON CONFLICT (id) DO UPDATE
      SET organization_id = EXCLUDED.organization_id,
          full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
          role = EXCLUDED.role,
          is_active = TRUE,
          updated_at = NOW();

    UPDATE public.team_invites
    SET status = 'accepted',
        accepted_at = NOW(),
        accepted_profile_id = new.id,
        updated_at = NOW()
    WHERE id = invite_row.id;

    RETURN new;
  END IF;

  -- Default self-signup flow: create a new organization and owner profile.
  INSERT INTO public.organizations (name, slug)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'organization_name', 'Minha Imobiliária'),
    gen_random_uuid()::text
  )
  RETURNING id INTO new_org_id;

  INSERT INTO public.profiles (id, organization_id, full_name, role, is_active)
  VALUES (
    new.id,
    new_org_id,
    resolved_name,
    'owner',
    TRUE
  )
  ON CONFLICT (id) DO UPDATE
    SET organization_id = EXCLUDED.organization_id,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        role = 'owner',
        is_active = TRUE,
        updated_at = NOW();

  RETURN new;
END;
$$;
