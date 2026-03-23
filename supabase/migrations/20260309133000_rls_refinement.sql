-- Multi-tenant RLS Refinement for V1 Consolidation
-- Focus: Restrict read access (SELECT) for brokers to only see their own assigned entities, while managers/owners see all.

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
    OR assignee_id = auth.uid()
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
    OR contact_id IN (SELECT id FROM public.contacts WHERE assignee_id = auth.uid())
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
    OR contact_id IN (SELECT id FROM public.contacts WHERE assignee_id = auth.uid())
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
    OR contact_id IN (SELECT id FROM public.contacts WHERE assignee_id = auth.uid())
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
