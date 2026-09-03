-- Fix assignment drift between app and database for contacts/proposals/contracts/appointments
-- Contacts use assigned_to as the current assignee. Older SQL still referenced broker_id/assignee_id.

CREATE OR REPLACE FUNCTION public.notify_new_lead()
RETURNS TRIGGER AS $$
DECLARE
  v_assigned_to uuid;
  v_org_id uuid;
BEGIN
  IF NEW.type != 'lead' THEN
    RETURN NEW;
  END IF;

  v_org_id := NEW.organization_id;
  v_assigned_to := NEW.assigned_to;

  IF v_assigned_to IS NOT NULL THEN
    INSERT INTO public.notifications(organization_id, user_id, type, title, body, link)
    VALUES (
      v_org_id,
      v_assigned_to,
      'new_lead',
      'Novo lead recebido',
      COALESCE('De: ' || NEW.name, 'Novo lead sem nome'),
      '/contacts/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

DROP POLICY IF EXISTS "View proposals granular" ON public.deal_proposals;
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

DROP POLICY IF EXISTS "View contracts granular" ON public.deal_contracts;
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

DROP POLICY IF EXISTS "View appointments granular" ON public.appointments;
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
