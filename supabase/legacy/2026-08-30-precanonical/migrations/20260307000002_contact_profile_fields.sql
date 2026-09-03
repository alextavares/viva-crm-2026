-- Add profile/interest fields to the contacts table for matching properties

ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS interest_type TEXT,
ADD COLUMN IF NOT EXISTS interest_bedrooms INTEGER,
ADD COLUMN IF NOT EXISTS interest_price_max NUMERIC,
ADD COLUMN IF NOT EXISTS interest_neighborhoods TEXT[];

-- Create indexes for fields heavily used in matching and filtering
CREATE INDEX IF NOT EXISTS idx_contacts_city ON public.contacts(city);
CREATE INDEX IF NOT EXISTS idx_contacts_interest_type ON public.contacts(interest_type);
CREATE INDEX IF NOT EXISTS idx_contacts_interest_bedrooms ON public.contacts(interest_bedrooms);

-- Add comments for documentation
COMMENT ON COLUMN public.contacts.city IS 'City where the contact lives or is interested in';
COMMENT ON COLUMN public.contacts.interest_type IS 'Preferred property type (e.g., apartment, house)';
COMMENT ON COLUMN public.contacts.interest_bedrooms IS 'Preferred number of bedrooms';
COMMENT ON COLUMN public.contacts.interest_price_max IS 'Maximum price the contact is willing to pay';
COMMENT ON COLUMN public.contacts.interest_neighborhoods IS 'List of preferred neighborhoods';
