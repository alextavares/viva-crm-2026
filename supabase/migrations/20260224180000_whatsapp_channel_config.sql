-- Sprint 4 / Story E003-S002
-- Configuracao do canal WhatsApp oficial por tenant

CREATE TABLE IF NOT EXISTS public.whatsapp_channel_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'meta' CHECK (provider IN ('meta')),
  display_phone TEXT,
  business_account_id TEXT,
  phone_number_id TEXT,
  webhook_verify_token TEXT,
  access_token TEXT,
  access_token_last4 TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connected', 'error')),
  last_error_message TEXT,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_channel_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View whatsapp channel settings in same org" ON whatsapp_channel_settings';
  EXECUTE 'CREATE POLICY "View whatsapp channel settings in same org" ON whatsapp_channel_settings
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage whatsapp channel settings" ON whatsapp_channel_settings';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage whatsapp channel settings" ON whatsapp_channel_settings
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_channel_settings_status
  ON public.whatsapp_channel_settings(status);

NOTIFY pgrst, 'reload schema';

