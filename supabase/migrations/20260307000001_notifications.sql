-- Sprint B: Notifications table + trigger for new leads

CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id, read_at)
  WHERE read_at IS NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_notifications"
  ON notifications
  FOR ALL
  USING (user_id = auth.uid());

-- Trigger: notify assigned broker when a new lead contact is created
CREATE OR REPLACE FUNCTION notify_new_lead()
RETURNS TRIGGER AS $$
DECLARE
  v_broker_id uuid;
  v_org_id uuid;
BEGIN
  IF NEW.type != 'lead' THEN
    RETURN NEW;
  END IF;

  v_org_id := NEW.organization_id;
  v_broker_id := NEW.broker_id;

  IF v_broker_id IS NOT NULL THEN
    INSERT INTO notifications(organization_id, user_id, type, title, body, link)
    VALUES (
      v_org_id,
      v_broker_id,
      'new_lead',
      'Novo lead recebido',
      COALESCE('De: ' || NEW.name, 'Novo lead sem nome'),
      '/contacts/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_lead ON contacts;
CREATE TRIGGER trg_notify_new_lead
  AFTER INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_lead();
