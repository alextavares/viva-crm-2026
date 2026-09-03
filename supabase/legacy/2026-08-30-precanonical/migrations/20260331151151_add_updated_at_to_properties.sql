ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.properties
SET updated_at = COALESCE(updated_at, NOW())
WHERE updated_at IS NULL;

ALTER TABLE public.properties
  ALTER COLUMN updated_at SET DEFAULT NOW();

NOTIFY pgrst, 'reload schema';
