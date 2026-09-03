-- Canonical baseline: foundation. This file is intentionally independent of the
-- archived pre-canonical timeline.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgtap with schema extensions;

create schema if not exists private;
create schema if not exists api;

revoke all on schema public from public, anon, authenticated, service_role;
revoke all on schema private from public, anon, authenticated, service_role;
revoke all on schema api from public, anon, authenticated, service_role;
grant usage on schema public to anon, authenticated;
grant usage on schema api to anon, authenticated, service_role;

alter default privileges in schema public revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on functions from public, anon, authenticated, service_role;
alter default privileges in schema api revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema api revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema api revoke all on functions from public, anon, authenticated, service_role;
alter default privileges in schema private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema private revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema private revoke all on functions from public, anon, authenticated, service_role;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'imob_api_owner') then
    create role imob_api_owner nologin noinherit;
  end if;
end $$;
alter role imob_api_owner bypassrls;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
alter function private.touch_updated_at() owner to imob_api_owner;

create or replace function private.nonblank(value text, max_length integer default 500)
returns boolean
language sql
immutable
set search_path = ''
as $$ select value is not null and length(btrim(value)) between 1 and max_length $$;
alter function private.nonblank(text, integer) owner to imob_api_owner;

revoke all on function private.touch_updated_at() from public, anon, authenticated, service_role;
revoke all on function private.nonblank(text, integer) from public, anon, authenticated, service_role;

create or replace function private.path_uuid(value text)
returns uuid language plpgsql security definer set search_path = ''
as $$ begin return value::uuid; exception when others then return null; end $$;
alter function private.path_uuid(text) owner to imob_api_owner;
revoke all on function private.path_uuid(text) from public, anon, authenticated, service_role;
