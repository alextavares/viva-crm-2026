-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ORGANIZATIONS
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES (Extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  full_name TEXT,
  role TEXT DEFAULT 'broker' CHECK (role IN ('owner', 'manager', 'broker', 'assistant')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROPERTIES
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL,
  type TEXT, -- apartment, house, land, commercial
  status TEXT DEFAULT 'available', -- available, sold, rented
  features JSONB DEFAULT '{}', -- bedrooms, bathrooms, area, garage, etc.
  address JSONB DEFAULT '{}', -- street, number, city, state, zip
  images TEXT[] DEFAULT '{}',
  broker_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CONTACTS (Leads/Clients)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'new', -- new, contacted, qualified, lost, won
  type TEXT DEFAULT 'lead', -- lead, client, owner
  assigned_to UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) NOT NULL,
  property_id UUID REFERENCES properties(id),
  contact_id UUID REFERENCES contacts(id),
  broker_id UUID REFERENCES profiles(id),
  date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled, no_show
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Organizations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Users can view own organization'
    ) THEN
        CREATE POLICY "Users can view own organization" ON organizations
        FOR SELECT USING (
            id IN (SELECT organization_id FROM profiles WHERE profiles.id = auth.uid())
        );
    END IF;
END
$$;

-- Profiles
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view profiles in same org'
    ) THEN
        CREATE POLICY "Users can view profiles in same org" ON profiles
        FOR SELECT USING (
            organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile" ON profiles
        FOR UPDATE USING (
            id = auth.uid()
        );
    END IF;
END
$$;

-- Properties
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'View properties in same org'
    ) THEN
        CREATE POLICY "View properties in same org" ON properties
        FOR SELECT USING (
            organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Create properties if member of org'
    ) THEN
        CREATE POLICY "Create properties if member of org" ON properties
        FOR INSERT WITH CHECK (
            organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'properties' AND policyname = 'Update properties in same org'
    ) THEN
        CREATE POLICY "Update properties in same org" ON properties
        FOR UPDATE USING (
            organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;

    -- RBAC: Owner/Manager Delete
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
END
$$;

-- Contacts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'View contacts in same org'
    ) THEN
        CREATE POLICY "View contacts in same org" ON contacts
        FOR SELECT USING (
            organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'Create contacts if member of org'
    ) THEN
        CREATE POLICY "Create contacts if member of org" ON contacts
        FOR INSERT WITH CHECK (
            organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;

    -- RBAC: Owner/Manager Delete
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
$$;

-- Appointments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'View appointments in same org'
    ) THEN
        CREATE POLICY "View appointments in same org" ON appointments
        FOR SELECT USING (
            organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'Create appointments if member of org'
    ) THEN
        CREATE POLICY "Create appointments if member of org" ON appointments
        FOR INSERT WITH CHECK (
            organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;

    -- RBAC: Owner/Manager Delete (ADDED per User Request)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'Owners/Managers can delete appointments'
    ) THEN
        CREATE POLICY "Owners/Managers can delete appointments" ON appointments
        FOR DELETE USING (
            organization_id IN (
              SELECT organization_id FROM profiles 
              WHERE id = auth.uid() AND role IN ('owner', 'manager')
            )
        );
    END IF;
END
$$;

-- TRIGGER: Handle New User
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
  EXECUTE FUNCTION public.handle_new_user();;
