-- Compatibility migration:
-- Some environments have profiles without updated_at.
-- Ensure column exists for trigger paths that write updated_at.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.profiles
SET updated_at = COALESCE(updated_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN updated_at SET DEFAULT NOW();
