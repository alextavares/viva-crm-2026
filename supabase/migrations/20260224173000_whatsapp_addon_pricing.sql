-- Sprint 4 / Story E003-S001
-- Pricing do add-on WhatsApp por organizacao (tenant)

CREATE TABLE IF NOT EXISTS public.whatsapp_addon_pricing_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  addon_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  included_quota INTEGER NOT NULL DEFAULT 0 CHECK (included_quota BETWEEN 0 AND 1000000),
  overage_price NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (overage_price >= 0),
  currency_code TEXT NOT NULL DEFAULT 'BRL' CHECK (currency_code ~ '^[A-Z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_addon_pricing_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "View whatsapp addon pricing in same org" ON whatsapp_addon_pricing_settings';
  EXECUTE 'CREATE POLICY "View whatsapp addon pricing in same org" ON whatsapp_addon_pricing_settings
    FOR SELECT USING (organization_id = public.current_user_org_id())';

  EXECUTE 'DROP POLICY IF EXISTS "Owners/Managers can manage whatsapp addon pricing" ON whatsapp_addon_pricing_settings';
  EXECUTE 'CREATE POLICY "Owners/Managers can manage whatsapp addon pricing" ON whatsapp_addon_pricing_settings
    FOR ALL
    USING (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))
    WITH CHECK (organization_id = public.current_user_org_id() AND public.current_user_role() IN (''owner'', ''manager''))';
END
$$;

NOTIFY pgrst, 'reload schema';

