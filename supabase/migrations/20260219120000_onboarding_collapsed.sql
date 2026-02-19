-- Persisted onboarding UI state (per organization).
-- Allows the dashboard checklist to auto-collapse when activation is complete.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS onboarding_collapsed boolean NOT NULL DEFAULT false;

