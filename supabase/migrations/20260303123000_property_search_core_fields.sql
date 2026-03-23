-- Lean property core fields for better broker registration and future search expansion.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS transaction_type TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS owner_name TEXT,
  ADD COLUMN IF NOT EXISTS financing_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_area NUMERIC,
  ADD COLUMN IF NOT EXISTS built_area NUMERIC,
  ADD COLUMN IF NOT EXISTS publish_to_portals BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS publish_zap BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS publish_imovelweb BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS publish_olx BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.properties
SET
  built_area = CASE
    WHEN built_area IS NOT NULL THEN built_area
    WHEN COALESCE(features->>'area', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (features->>'area')::NUMERIC
    ELSE NULL
  END,
  total_area = CASE
    WHEN total_area IS NOT NULL THEN total_area
    WHEN COALESCE(features->>'total_area', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (features->>'total_area')::NUMERIC
    WHEN COALESCE(features->>'area', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (features->>'area')::NUMERIC
    ELSE NULL
  END,
  transaction_type = COALESCE(
    NULLIF(transaction_type, ''),
    CASE
      WHEN status = 'rented' THEN 'rent'
      ELSE 'sale'
    END
  ),
  purpose = COALESCE(
    NULLIF(purpose, ''),
    CASE
      WHEN type IN ('commercial', 'commercial_space') THEN 'commercial'
      ELSE 'residential'
    END
  );
