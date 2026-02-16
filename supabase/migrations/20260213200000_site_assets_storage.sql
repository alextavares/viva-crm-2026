-- Storage bucket + policies for public website assets (logo, banners).
-- Note: This migration must run with sufficient privileges to modify `storage.*` (typically via Supabase migrations/CLI).

-- 1) Create bucket (public read). The website needs to load these images without auth.
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2) Policies on storage.objects
-- Conventions:
-- - Files must be stored under: org/{organization_id}/site/{filename}
-- - Only owner/manager can write/delete, and only within their org prefix.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access Site Assets'
  ) THEN
    CREATE POLICY "Public Access Site Assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'site-assets');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Owner/Manager Upload Site Assets'
  ) THEN
    CREATE POLICY "Owner/Manager Upload Site Assets"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'site-assets'
      AND auth.role() = 'authenticated'
      AND public.current_user_role() IN ('owner', 'manager')
      AND name LIKE ('org/' || public.current_user_org_id()::text || '/site/%')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Owner/Manager Update Site Assets'
  ) THEN
    CREATE POLICY "Owner/Manager Update Site Assets"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'site-assets'
      AND auth.role() = 'authenticated'
      AND public.current_user_role() IN ('owner', 'manager')
      AND name LIKE ('org/' || public.current_user_org_id()::text || '/site/%')
    )
    WITH CHECK (
      bucket_id = 'site-assets'
      AND auth.role() = 'authenticated'
      AND public.current_user_role() IN ('owner', 'manager')
      AND name LIKE ('org/' || public.current_user_org_id()::text || '/site/%')
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Owner/Manager Delete Site Assets'
  ) THEN
    CREATE POLICY "Owner/Manager Delete Site Assets"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'site-assets'
      AND auth.role() = 'authenticated'
      AND public.current_user_role() IN ('owner', 'manager')
      AND name LIKE ('org/' || public.current_user_org_id()::text || '/site/%')
    );
  END IF;
END
$$;

