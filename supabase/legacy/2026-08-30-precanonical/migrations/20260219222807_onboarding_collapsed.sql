ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS onboarding_collapsed boolean NOT NULL DEFAULT false;;
