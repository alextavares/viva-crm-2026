ALTER TABLE public.message_templates
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.message_templates
SET updated_at = created_at
WHERE updated_at IS NULL;

NOTIFY pgrst, 'reload schema';
