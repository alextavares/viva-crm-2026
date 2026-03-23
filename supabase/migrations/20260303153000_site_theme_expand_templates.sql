ALTER TABLE public.site_settings
  DROP CONSTRAINT IF EXISTS site_settings_theme_check;

ALTER TABLE public.site_settings
  ADD CONSTRAINT site_settings_theme_check
  CHECK (theme IN ('search_first', 'search_highlights', 'premium', 'trust_first', 'compact_mobile'));
