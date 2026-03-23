-- Migration: Add owner_contact_id to properties
ALTER TABLE public.properties
ADD COLUMN owner_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS properties_owner_contact_id_idx ON public.properties(owner_contact_id);
