-- Sprint B: Contact Interactions
-- Manual activity log for calls, emails, visits and notes

CREATE TABLE IF NOT EXISTS contact_interactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'visit', 'note', 'whatsapp')),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  summary TEXT NOT NULL,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact_id
  ON contact_interactions(contact_id, happened_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_org_id
  ON contact_interactions(organization_id, happened_at DESC);

ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_contact_interactions"
  ON contact_interactions
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
