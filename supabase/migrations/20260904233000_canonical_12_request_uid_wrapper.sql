-- Canonical baseline: request_uid() wrapper so definer helpers never touch auth schema.
-- Managed Supabase blocks GRANT USAGE ON SCHEMA auth (migration 11 accepted but
-- ineffective); a postgres-owned wrapper restores standard posture without
-- broadening auth privileges. RLS stays fail-closed.
create or replace function private.request_uid()
returns uuid language sql stable security definer set search_path = ''
as $$ select auth.uid() $$;
alter function private.request_uid() owner to postgres;
revoke all on function private.request_uid() from public, anon, authenticated, service_role;
grant execute on function private.request_uid() to imob_api_owner;

create or replace function private.current_org_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select p.organization_id from public.profiles p where p.id = (select private.request_uid()) and p.is_active limit 1 $$;
alter function private.current_org_id() owner to imob_api_owner;
create or replace function private.current_role()
returns text language sql stable security definer set search_path = ''
as $$ select p.role from public.profiles p where p.id = (select private.request_uid()) and p.is_active limit 1 $$;
alter function private.current_role() owner to imob_api_owner;
