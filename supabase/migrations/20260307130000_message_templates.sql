CREATE TABLE message_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  channel TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','email')),
  variables TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON message_templates(organization_id);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org templates view" ON message_templates
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "org templates insert" ON message_templates
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "org templates update" ON message_templates
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "org templates delete" ON message_templates
  FOR DELETE USING (organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
