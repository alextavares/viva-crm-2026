-- Multi-tenant RLS hardening (2026-02-13)
--
-- IMPORTANT:
-- - This codebase does NOT have a `public.leads` table; "leads" live as `public.contacts`
--   plus timeline/messages in `public.contact_events` and `public.messages`.
-- - The previous version of this migration referenced `leads` and used subqueries into
--   `profiles` inside policies, which can be slow and can reintroduce policy-recursion issues.
-- - This migration aligns with the current approach in `supabase/schema.sql` by using
--   SECURITY DEFINER helpers.

-- 1) RLS helper functions (idempotent)
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_org_id() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated;

-- 2) Enable RLS on contacts (idempotent)
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- 3) Drop any incorrect/legacy policy names (idempotent)
DROP POLICY IF EXISTS "Contacts: isolamento por organização" ON public.contacts;
DROP POLICY IF EXISTS "Leads: isolamento por organização" ON public.contacts;

-- 4) Contacts policies (aligned with schema.sql)
DROP POLICY IF EXISTS "View contacts in same org" ON public.contacts;
CREATE POLICY "View contacts in same org"
ON public.contacts
FOR SELECT
TO authenticated
USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Create contacts if member of org" ON public.contacts;
CREATE POLICY "Create contacts if member of org"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Update contacts granular" ON public.contacts;
CREATE POLICY "Update contacts granular"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND (public.current_user_role() IN ('owner', 'manager') OR assigned_to = auth.uid())
)
WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Owners/Managers can delete contacts" ON public.contacts;
CREATE POLICY "Owners/Managers can delete contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (
  organization_id = public.current_user_org_id()
  AND public.current_user_role() IN ('owner', 'manager')
);
