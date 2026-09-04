-- Canonical baseline: PostgREST privilege grants.
-- Least-privilege companion to 08_rls_grants: 08 defines row policies but grants
-- no table privileges, so every PostgREST read/write fails with 42501. This file
-- grants only what the policy matrix assumes. RLS stays enforced (FORCE RLS from
-- 08 untouched); no BYPASSRLS for app roles; anon/private surfaces unchanged.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'imob_api_owner') then
    create role imob_api_owner nologin noinherit;
  end if;
end $$;
alter role imob_api_owner bypassrls;
grant imob_api_owner to postgres;
grant usage, create on schema private to imob_api_owner;
grant usage, create on schema api to imob_api_owner;

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated, service_role;
