-- FUNCTION: Handle New User
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- 1. Create a default Organization for the user
  INSERT INTO public.organizations (name, slug)
  VALUES (
    COALESCE(new.raw_user_meta_data->>'organization_name', 'Minha Imobiliária'), 
    uuid_generate_v4()::text -- Temporary slug, can be updated later
  )
  RETURNING id INTO new_org_id;

  -- 2. Create the Profile linked to the user and organization
  INSERT INTO public.profiles (id, organization_id, full_name, role)
  VALUES (
    new.id,
    new_org_id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    'owner' -- First user is always owner of their org
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TRIGGER: On Auth User Created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- RBAC: DELETE Policies (Owner/Manager only)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Owners/Managers can delete properties'
    ) THEN
        CREATE POLICY "Owners/Managers can delete properties" ON properties
        FOR DELETE USING (
            organization_id IN (
              SELECT organization_id FROM profiles 
              WHERE id = auth.uid() AND role IN ('owner', 'manager')
            )
        );
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'Owners/Managers can delete contacts'
    ) THEN
        CREATE POLICY "Owners/Managers can delete contacts" ON contacts
        FOR DELETE USING (
            organization_id IN (
              SELECT organization_id FROM profiles 
              WHERE id = auth.uid() AND role IN ('owner', 'manager')
            )
        );
    END IF;
END
$$;;
