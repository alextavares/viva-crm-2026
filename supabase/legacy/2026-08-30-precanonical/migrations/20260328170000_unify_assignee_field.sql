-- Unified profile assignment field names to 'assigned_to'
-- This fixes the fragmentation where some tables used broker_id and others used assigned_to.
-- It also fixes stale triggers on the contacts table.

DO $$
BEGIN
    -- 1. APPOINTMENTS
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'broker_id') THEN
        ALTER TABLE appointments RENAME COLUMN broker_id TO assigned_to;
    END IF;

    -- 2. DEAL_PROPOSALS
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_proposals' AND column_name = 'broker_id') THEN
        ALTER TABLE deal_proposals RENAME COLUMN broker_id TO assigned_to;
    END IF;

    -- 3. DEAL_CONTRACTS
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deal_contracts' AND column_name = 'broker_id') THEN
        ALTER TABLE deal_contracts RENAME COLUMN broker_id TO assigned_to;
    END IF;

    -- 4. PROPERTIES (Optional but recommended for consistency)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'broker_id') THEN
        ALTER TABLE properties RENAME COLUMN broker_id TO assigned_to;
    END IF;

    -- 5. FIX STALE TRIGGERS ON CONTACTS
    -- We'll drop and recreate the known triggers to ensure they use assigned_to
    -- If there's any hidden trigger using NEW.broker_id, this RECREATE approach should fix it.

    -- Notify New Lead Trigger
    DROP TRIGGER IF EXISTS trg_notify_new_lead ON contacts;
    CREATE OR REPLACE FUNCTION notify_new_lead()
    RETURNS TRIGGER AS $trg$
    DECLARE
      v_assigned_to uuid;
      v_org_id uuid;
    BEGIN
      IF NEW.type != 'lead' THEN
        RETURN NEW;
      END IF;

      v_org_id := NEW.organization_id;
      -- We explicitly use assigned_to here
      v_assigned_to := NEW.assigned_to;

      IF v_assigned_to IS NOT NULL THEN
        INSERT INTO notifications(organization_id, user_id, type, title, body, link)
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
    $trg$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE TRIGGER trg_notify_new_lead
      AFTER INSERT ON contacts
      FOR EACH ROW
      EXECUTE FUNCTION notify_new_lead();

END
$$;

-- RLS Refinement for the renamed columns
-- (These will need updated policies if they directly used broker_id)

-- Appointments
DROP POLICY IF EXISTS "Update appointments granular" ON appointments;
CREATE POLICY "Update appointments granular" ON appointments 
FOR UPDATE USING (
  organization_id = public.current_user_org_id() 
  AND (public.current_user_role() IN ('owner', 'manager') OR assigned_to = auth.uid())
);

-- Proposals
DROP POLICY IF EXISTS "Update proposals granular" ON deal_proposals;
CREATE POLICY "Update proposals granular" ON deal_proposals 
FOR UPDATE USING (
  organization_id = public.current_user_org_id() 
  AND (public.current_user_role() IN ('owner', 'manager') OR assigned_to = auth.uid())
);

-- Contracts
DROP POLICY IF EXISTS "Update contracts granular" ON deal_contracts;
CREATE POLICY "Update contracts granular" ON deal_contracts 
FOR UPDATE USING (
  organization_id = public.current_user_org_id() 
  AND (public.current_user_role() IN ('owner', 'manager') OR assigned_to = auth.uid())
);

-- Properties
DROP POLICY IF EXISTS "Update properties granular" ON properties;
CREATE POLICY "Update properties granular" ON properties 
FOR UPDATE USING (
  organization_id = public.current_user_org_id() 
  AND (public.current_user_role() IN ('owner', 'manager') OR assigned_to = auth.uid())
);

NOTIFY pgrst, 'reload schema';
