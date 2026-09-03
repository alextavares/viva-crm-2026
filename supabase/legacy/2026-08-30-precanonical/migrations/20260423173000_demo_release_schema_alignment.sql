-- Align the local/demo schema with the release-critical shape expected by the app.
-- Root causes addressed here:
-- 1. `properties` still uses `broker_id` even though later code expects `assigned_to`.
-- 2. `deal_proposals` and `deal_contracts` are referenced by code/types but were never created here.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'broker_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'properties'
      AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE public.properties RENAME COLUMN broker_id TO assigned_to;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.deal_proposals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  contact_id uuid NOT NULL,
  assigned_to uuid NULL,
  property_id uuid NULL,
  proposed_value numeric NOT NULL DEFAULT 0,
  payment_conditions text NULL,
  valid_until text NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_proposals_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT deal_proposals_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE,
  CONSTRAINT deal_proposals_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT deal_proposals_property_id_fkey
    FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deal_proposals_org_created_at
  ON public.deal_proposals (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_contact_id
  ON public.deal_proposals (contact_id);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_assigned_to
  ON public.deal_proposals (assigned_to);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_status
  ON public.deal_proposals (status);

CREATE TABLE IF NOT EXISTS public.deal_contracts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  property_id uuid NULL,
  contact_id uuid NULL,
  assigned_to uuid NULL,
  proposal_id uuid NULL,
  contract_type text NOT NULL DEFAULT 'sale',
  final_value numeric NOT NULL DEFAULT 0,
  commission_value numeric NULL,
  status text NOT NULL DEFAULT 'draft',
  start_date text NULL,
  end_date text NULL,
  document_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_contracts_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT deal_contracts_property_id_fkey
    FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL,
  CONSTRAINT deal_contracts_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL,
  CONSTRAINT deal_contracts_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT deal_contracts_proposal_id_fkey
    FOREIGN KEY (proposal_id) REFERENCES public.deal_proposals(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_deal_contracts_org_created_at
  ON public.deal_contracts (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_contracts_contact_id
  ON public.deal_contracts (contact_id);
CREATE INDEX IF NOT EXISTS idx_deal_contracts_assigned_to
  ON public.deal_contracts (assigned_to);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_contracts_proposal_id_unique
  ON public.deal_contracts (proposal_id)
  WHERE proposal_id IS NOT NULL;

ALTER TABLE public.deal_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_contracts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Update properties granular" ON public.properties;
  CREATE POLICY "Update properties granular"
    ON public.properties
    FOR UPDATE
    USING (
      organization_id = public.current_user_org_id()
      AND (
        public.current_user_role() IN ('owner', 'manager')
        OR assigned_to = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "View proposals in same org" ON public.deal_proposals;
  CREATE POLICY "View proposals in same org"
    ON public.deal_proposals
    FOR SELECT
    USING (organization_id = public.current_user_org_id());

  DROP POLICY IF EXISTS "Create proposals if member of org" ON public.deal_proposals;
  CREATE POLICY "Create proposals if member of org"
    ON public.deal_proposals
    FOR INSERT
    WITH CHECK (organization_id = public.current_user_org_id());

  DROP POLICY IF EXISTS "Update proposals granular" ON public.deal_proposals;
  CREATE POLICY "Update proposals granular"
    ON public.deal_proposals
    FOR UPDATE
    USING (
      organization_id = public.current_user_org_id()
      AND (
        public.current_user_role() IN ('owner', 'manager')
        OR assigned_to = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Owners/Managers can delete proposals" ON public.deal_proposals;
  CREATE POLICY "Owners/Managers can delete proposals"
    ON public.deal_proposals
    FOR DELETE
    USING (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN ('owner', 'manager')
    );

  DROP POLICY IF EXISTS "View contracts in same org" ON public.deal_contracts;
  CREATE POLICY "View contracts in same org"
    ON public.deal_contracts
    FOR SELECT
    USING (organization_id = public.current_user_org_id());

  DROP POLICY IF EXISTS "Owners/Managers can create contracts" ON public.deal_contracts;
  CREATE POLICY "Owners/Managers can create contracts"
    ON public.deal_contracts
    FOR INSERT
    WITH CHECK (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN ('owner', 'manager')
    );

  DROP POLICY IF EXISTS "Update contracts granular" ON public.deal_contracts;
  CREATE POLICY "Update contracts granular"
    ON public.deal_contracts
    FOR UPDATE
    USING (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN ('owner', 'manager')
    );

  DROP POLICY IF EXISTS "Owners/Managers can delete contracts" ON public.deal_contracts;
  CREATE POLICY "Owners/Managers can delete contracts"
    ON public.deal_contracts
    FOR DELETE
    USING (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN ('owner', 'manager')
    );
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_proposals TO authenticated;
GRANT ALL ON public.deal_proposals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_contracts TO authenticated;
GRANT ALL ON public.deal_contracts TO service_role;

NOTIFY pgrst, 'reload schema';
