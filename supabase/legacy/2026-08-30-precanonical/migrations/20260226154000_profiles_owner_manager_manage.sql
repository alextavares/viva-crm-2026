-- Allow owner/manager to manage profiles from the same organization.

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage profiles in same org" ON profiles';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage profiles in same org" ON profiles
    FOR UPDATE
    USING (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN (''owner'', ''manager'')
    )
    WITH CHECK (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN (''owner'', ''manager'')
    )';
END
$$;
