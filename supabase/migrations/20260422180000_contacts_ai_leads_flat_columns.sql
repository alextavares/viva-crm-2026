ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS interest_type TEXT,
  ADD COLUMN IF NOT EXISTS interest_bedrooms INTEGER,
  ADD COLUMN IF NOT EXISTS interest_price_max NUMERIC;

-- Apply locally: docker exec -i supabase_db_viva_crm psql -U postgres -d postgres < supabase/migrations/20260422180000_contacts_ai_leads_flat_columns.sql
