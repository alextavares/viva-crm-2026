-- Sprint 40 / E6-S040
-- Pré-atendimento IA no WhatsApp com qualificação estruturada e handoff comercial.

CREATE TABLE IF NOT EXISTS public.ai_lead_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'qualified', 'handoff_requested', 'handoff_completed', 'paused', 'closed')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('site', 'portal', 'manual', 'whatsapp')),
  current_step text NOT NULL DEFAULT 'intent',
  assigned_to_at_handoff uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NULL,
  qualified_at timestamptz NULL,
  handoff_requested_at timestamptz NULL,
  handoff_completed_at timestamptz NULL,
  paused_at timestamptz NULL,
  closed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_lead_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.ai_lead_sessions(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  author text NOT NULL CHECK (author IN ('ai', 'contact', 'broker', 'system')),
  channel text NOT NULL DEFAULT 'whatsapp',
  content text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_lead_qualifications (
  session_id uuid PRIMARY KEY REFERENCES public.ai_lead_sessions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  intent text NULL,
  transaction_type text NULL,
  property_type text NULL,
  city text NULL,
  neighborhoods text[] NULL,
  budget_min numeric(12,2) NULL,
  budget_max numeric(12,2) NULL,
  timeline text NULL,
  stage_score integer NOT NULL DEFAULT 0 CHECK (stage_score BETWEEN 0 AND 100),
  summary text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS ai_status text NULL,
  ADD COLUMN IF NOT EXISTS ai_score integer NULL,
  ADD COLUMN IF NOT EXISTS ai_last_summary text NULL,
  ADD COLUMN IF NOT EXISTS qualified_by_ai_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS handoff_to_profile_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handoff_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_ai_lead_sessions_org_status
  ON public.ai_lead_sessions(organization_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_lead_sessions_contact_created
  ON public.ai_lead_sessions(contact_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_lead_sessions_contact_active_unique
  ON public.ai_lead_sessions(contact_id)
  WHERE status IN ('active', 'qualified', 'handoff_requested', 'paused');

CREATE INDEX IF NOT EXISTS idx_ai_lead_messages_session_created
  ON public.ai_lead_messages(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_lead_messages_org_created
  ON public.ai_lead_messages(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_lead_qualifications_org_score
  ON public.ai_lead_qualifications(organization_id, stage_score DESC, updated_at DESC);

ALTER TABLE public.ai_lead_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_lead_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_lead_qualifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View ai lead sessions in same org" ON public.ai_lead_sessions';
  EXECUTE 'CREATE POLICY "View ai lead sessions in same org" ON public.ai_lead_sessions
    FOR SELECT TO authenticated
    USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage ai lead sessions" ON public.ai_lead_sessions';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage ai lead sessions" ON public.ai_lead_sessions
    FOR ALL TO authenticated
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View ai lead messages in same org" ON public.ai_lead_messages';
  EXECUTE 'CREATE POLICY "View ai lead messages in same org" ON public.ai_lead_messages
    FOR SELECT TO authenticated
    USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage ai lead messages" ON public.ai_lead_messages';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage ai lead messages" ON public.ai_lead_messages
    FOR ALL TO authenticated
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View ai lead qualifications in same org" ON public.ai_lead_qualifications';
  EXECUTE 'CREATE POLICY "View ai lead qualifications in same org" ON public.ai_lead_qualifications
    FOR SELECT TO authenticated
    USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage ai lead qualifications" ON public.ai_lead_qualifications';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage ai lead qualifications" ON public.ai_lead_qualifications
    FOR ALL TO authenticated
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;
