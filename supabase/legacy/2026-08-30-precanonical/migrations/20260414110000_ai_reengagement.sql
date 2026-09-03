CREATE TABLE IF NOT EXISTS public.ai_lead_reengagement_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  first_delay_minutes integer NOT NULL DEFAULT 30,
  second_delay_minutes integer NOT NULL DEFAULT 180,
  third_delay_minutes integer NOT NULL DEFAULT 1440,
  message_template text NOT NULL DEFAULT 'Olá {{first_name}}, sigo à disposição para te ajudar com o imóvel ideal. Posso retomar por aqui?',
  sla_minutes integer NOT NULL DEFAULT 30,
  notify_broker boolean NOT NULL DEFAULT true,
  notify_manager boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_lead_reengagement_settings_first_delay_check CHECK (first_delay_minutes >= 1),
  CONSTRAINT ai_lead_reengagement_settings_second_delay_check CHECK (second_delay_minutes >= 1),
  CONSTRAINT ai_lead_reengagement_settings_third_delay_check CHECK (third_delay_minutes >= 1),
  CONSTRAINT ai_lead_reengagement_settings_sla_check CHECK (sla_minutes >= 1)
);

CREATE TABLE IF NOT EXISTS public.ai_lead_reengagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.ai_lead_sessions(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'scheduled',
  reason text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL,
  last_attempt_at timestamptz,
  last_attempt_message text,
  stopped_reason text,
  escalated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_lead_reengagements_status_check CHECK (
    status IN ('scheduled', 'running', 'waiting_response', 'completed', 'stopped', 'escalated')
  ),
  CONSTRAINT ai_lead_reengagements_reason_check CHECK (
    reason IN ('no_reply_after_first_message', 'qualified_without_human_action', 'handoff_without_human_action')
  ),
  CONSTRAINT ai_lead_reengagements_attempt_count_check CHECK (attempt_count >= 0),
  CONSTRAINT ai_lead_reengagements_max_attempts_check CHECK (max_attempts >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_lead_reengagements_open_session_reason
  ON public.ai_lead_reengagements (session_id, reason)
  WHERE status IN ('scheduled', 'running', 'waiting_response');

CREATE INDEX IF NOT EXISTS idx_ai_lead_reengagements_due
  ON public.ai_lead_reengagements (organization_id, status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_ai_lead_reengagements_contact
  ON public.ai_lead_reengagements (organization_id, contact_id, created_at DESC);

ALTER TABLE public.ai_lead_reengagement_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_lead_reengagements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View ai reengagement settings in same org" ON ai_lead_reengagement_settings';
  EXECUTE 'CREATE POLICY "View ai reengagement settings in same org" ON ai_lead_reengagement_settings
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage ai reengagement settings" ON ai_lead_reengagement_settings';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage ai reengagement settings" ON ai_lead_reengagement_settings
    FOR ALL USING (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN (''owner'', ''manager'')
    )
    WITH CHECK (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN (''owner'', ''manager'')
    )';

  EXECUTE 'DROP POLICY IF EXISTS "View ai reengagements in same org" ON ai_lead_reengagements';
  EXECUTE 'CREATE POLICY "View ai reengagements in same org" ON ai_lead_reengagements
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage ai reengagements" ON ai_lead_reengagements';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage ai reengagements" ON ai_lead_reengagements
    FOR ALL USING (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN (''owner'', ''manager'')
    )
    WITH CHECK (
      organization_id = public.current_user_org_id()
      AND public.current_user_role() IN (''owner'', ''manager'')
    )';
END $$;
