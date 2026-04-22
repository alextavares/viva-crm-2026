ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS interest_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Apply locally: docker exec -i supabase_db_viva_crm psql -U postgres -d postgres < supabase/migrations/20260422173000_contacts_interest_profile.sql
