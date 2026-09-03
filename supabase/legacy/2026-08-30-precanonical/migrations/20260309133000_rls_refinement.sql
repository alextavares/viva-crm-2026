-- Multi-tenant RLS Refinement for V1 Consolidation
-- Focus: Restrict read access (SELECT) for brokers to only see their own assigned entities, while managers/owners see all.

-- These deal tables were referenced by later app code and policies, but they
-- never existed in the migration timeline used by `supabase db reset`.
CREATE TABLE IF NOT EXISTS public.deal_proposals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  broker_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  property_id uuid NULL REFERENCES public.properties(id) ON DELETE SET NULL,
  proposed_value numeric NOT NULL DEFAULT 0,
  payment_conditions text NULL,
  valid_until text NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_proposals_org_created_at
  ON public.deal_proposals (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_contact_id
  ON public.deal_proposals (contact_id);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_broker_id
  ON public.deal_proposals (broker_id);
CREATE INDEX IF NOT EXISTS idx_deal_proposals_status
  ON public.deal_proposals (status);

CREATE TABLE IF NOT EXISTS public.deal_contracts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NULL REFERENCES public.properties(id) ON DELETE SET NULL,
  contact_id uuid NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  broker_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  proposal_id uuid NULL REFERENCES public.deal_proposals(id) ON DELETE SET NULL,
  contract_type text NOT NULL DEFAULT 'sale',
  final_value numeric NOT NULL DEFAULT 0,
  commission_value numeric NULL,
  status text NOT NULL DEFAULT 'draft',
  start_date text NULL,
  end_date text NULL,
  document_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deal_contracts_org_created_at
  ON public.deal_contracts (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_contracts_contact_id
  ON public.deal_contracts (contact_id);
CREATE INDEX IF NOT EXISTS idx_deal_contracts_broker_id
  ON public.deal_contracts (broker_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_contracts_proposal_id_unique
  ON public.deal_contracts (proposal_id)
  WHERE proposal_id IS NOT NULL;

ALTER TABLE public.deal_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_contracts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_proposals TO authenticated;
GRANT ALL ON public.deal_proposals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_contracts TO authenticated;
GRANT ALL ON public.deal_contracts TO service_role;

-- 1) Contacts policies refinement
DROP POLICY IF EXISTS "View contacts in same org" ON public.contacts;
CREATE POLICY "View contacts in same org"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.current_user_role() IN ('owner', 'manager') 
    OR assigned_to = auth.uid()
  )
);

-- 2) Proposals policies refinement
-- Only see proposals if manager/owner, OR if you are the broker tied to the proposal, OR if you are the assignee of the related contact
DROP POLICY IF EXISTS "org_proposals" ON public.deal_proposals;
CREATE POLICY "View proposals granular"
ON public.deal_proposals
FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.current_user_role() IN ('owner', 'manager') 
    OR broker_id = auth.uid()
    OR contact_id IN (SELECT id FROM public.contacts WHERE assigned_to = auth.uid())
  )
);

CREATE POLICY "Insert proposals if member of org"
ON public.deal_proposals
FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.current_user_org_id());

CREATE POLICY "Update proposals granular"
ON public.deal_proposals
FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.current_user_role() IN ('owner', 'manager') 
    OR broker_id = auth.uid()
  )
);

CREATE POLICY "Delete proposals granular"
ON public.deal_proposals
FOR DELETE
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.current_user_role() IN ('owner', 'manager') 
    OR broker_id = auth.uid()
  )
);

-- 3) Contracts policies refinement
-- Only see contracts if manager/owner, OR if you are the broker tied to the contract, OR if you are the assignee of the related contact
DROP POLICY IF EXISTS "org_contracts" ON public.deal_contracts;
CREATE POLICY "View contracts granular"
ON public.deal_contracts
FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.current_user_role() IN ('owner', 'manager') 
    OR broker_id = auth.uid()
    OR contact_id IN (SELECT id FROM public.contacts WHERE assigned_to = auth.uid())
  )
);

CREATE POLICY "Insert contracts if member of org"
ON public.deal_contracts
FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.current_user_org_id());

CREATE POLICY "Update contracts granular"
ON public.deal_contracts
FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.current_user_role() IN ('owner', 'manager') 
    OR broker_id = auth.uid()
  )
);

CREATE POLICY "Delete contracts granular"
ON public.deal_contracts
FOR DELETE
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.current_user_role() IN ('owner', 'manager') 
  )
);

-- 4) Appointments policies refinement (assuming table name is appointments)
DROP POLICY IF EXISTS "org_appointments" ON public.appointments;
DROP POLICY IF EXISTS "View appointments in same org" ON public.appointments;

CREATE POLICY "View appointments granular"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.current_user_role() IN ('owner', 'manager') 
    OR broker_id = auth.uid()
    OR contact_id IN (SELECT id FROM public.contacts WHERE assigned_to = auth.uid())
  )
);

-- Create/Update/Delete follows the view logic
CREATE POLICY "Insert appointments if member of org"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.current_user_org_id());

CREATE POLICY "Update appointments granular"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.current_user_role() IN ('owner', 'manager') 
    OR broker_id = auth.uid()
  )
);

CREATE POLICY "Delete appointments granular"
ON public.appointments
FOR DELETE
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (
    public.current_user_role() IN ('owner', 'manager') 
    OR broker_id = auth.uid()
  )
);
