ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS external_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.properties'::regclass
      AND contype = 'u'
      AND conname = 'properties_org_external_id_key'
  ) THEN
    ALTER TABLE public.properties
      ADD CONSTRAINT properties_org_external_id_key
      UNIQUE (organization_id, external_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_properties_external_id
  ON public.properties (external_id);
;
