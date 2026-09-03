-- Add deal_stage column to contacts table
-- Tracks the stage of a business deal for a lead/contact
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS deal_stage TEXT DEFAULT 'lead'
  CHECK (deal_stage IN ('lead','interest','visit','negotiation','closing','won','lost'));

-- Index for dashboard funnel queries
CREATE INDEX IF NOT EXISTS idx_contacts_deal_stage
  ON contacts (organization_id, deal_stage)
  WHERE deal_stage IS NOT NULL;

COMMENT ON COLUMN contacts.deal_stage IS 'Business deal stage: lead → interest → visit → negotiation → closing → won | lost';
