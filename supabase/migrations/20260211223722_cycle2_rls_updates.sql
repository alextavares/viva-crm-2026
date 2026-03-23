-- Contacts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'Update contacts in same org'
    ) THEN
        CREATE POLICY "Update contacts in same org" ON contacts
        FOR UPDATE USING (
            organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;
END
$$;

-- Appointments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'appointments' AND policyname = 'Update appointments in same org'
    ) THEN
        CREATE POLICY "Update appointments in same org" ON appointments
        FOR UPDATE USING (
            organization_id IN (
            SELECT organization_id FROM profiles WHERE id = auth.uid()
            )
        );
    END IF;
END
$$;;
