DROP POLICY IF EXISTS "Users can view profiles in same org" ON profiles;
CREATE POLICY "Users can view profiles in same org" ON profiles
  FOR SELECT USING (organization_id = public.current_user_org_id());
