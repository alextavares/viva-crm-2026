-- Persist the WhatsApp onboarding checklist UI state per organization.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS whatsapp_onboarding_collapsed boolean NOT NULL DEFAULT false;

