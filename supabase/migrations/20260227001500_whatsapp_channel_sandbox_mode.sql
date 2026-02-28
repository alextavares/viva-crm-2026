-- Add explicit operational mode for WhatsApp channel and allow dedicated inbound webhook source.

ALTER TABLE public.whatsapp_channel_settings
  ADD COLUMN IF NOT EXISTS operation_mode TEXT NOT NULL DEFAULT 'live'
  CHECK (operation_mode IN ('live', 'sandbox'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'webhook_endpoints'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'webhook_endpoints_source_check'
  ) THEN
    ALTER TABLE public.webhook_endpoints DROP CONSTRAINT webhook_endpoints_source_check;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'webhook_endpoints'
  ) THEN
    ALTER TABLE public.webhook_endpoints
      ADD CONSTRAINT webhook_endpoints_source_check
      CHECK (source IN ('site', 'portal_zap', 'portal_olx', 'portal_imovelweb', 'email_capture', 'whatsapp_inbound'));
  END IF;
END
$$;

