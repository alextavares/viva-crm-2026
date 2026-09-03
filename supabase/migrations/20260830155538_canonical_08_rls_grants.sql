create or replace function private.guard_immutable_fields()
returns trigger language plpgsql set search_path = ''
as $$
declare k text; old_json jsonb := to_jsonb(old); new_json jsonb := to_jsonb(new);
begin
  foreach k in array array['id','organization_id','created_at','created_by','actor_profile_id','user_id'] loop
    if old_json ? k and (new_json->>k) is distinct from (old_json->>k) then raise exception 'immutable field changed: %', k using errcode='42501'; end if;
  end loop;
  return new;
end $$;
alter function private.guard_immutable_fields() owner to imob_api_owner;

do $$
declare r record; has_assignee boolean; t text;
begin
  for r in select c.relname as table_name from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' loop
    execute format('alter table public.%I enable row level security',r.table_name);
    execute format('alter table public.%I force row level security',r.table_name);
    if r.table_name <> 'organizations' then
      execute format('create policy %I_tenant_read on public.%I for select to authenticated using (organization_id = (select private.current_org_id()) and ((select private.current_role()) in (''owner'',''manager'') or (select private.current_role()) = ''broker'' or (select private.current_role()) = ''assistant''))',r.table_name,r.table_name);
      execute format('create policy %I_tenant_owner_write on public.%I for all to authenticated using (organization_id = (select private.current_org_id()) and (select private.current_role()) in (''owner'',''manager'')) with check (organization_id = (select private.current_org_id()) and (select private.current_role()) in (''owner'',''manager''))',r.table_name,r.table_name);
    end if;
    if exists (select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=r.table_name and a.attname='id' and not a.attisdropped) then
      execute format('drop trigger if exists %I on public.%I',r.table_name||'_immutable',r.table_name);
      execute format('create trigger %I before update on public.%I for each row execute function private.guard_immutable_fields()',r.table_name||'_immutable',r.table_name);
    end if;
  end loop;
end $$;

drop policy if exists profiles_tenant_read on public.profiles;
create policy profiles_tenant_directory on public.profiles for select to authenticated using (organization_id = (select private.current_org_id()));
drop policy if exists team_audit_events_tenant_read on public.team_audit_events;
create policy team_audit_events_owner_read on public.team_audit_events for select to authenticated using (organization_id = (select private.current_org_id()) and (select private.current_role()) in ('owner','manager'));

do $$
declare t text;
begin
  foreach t in array array['contacts','properties','appointments','opportunities','proposals','contracts','contact_followups'] loop
    execute format('drop policy if exists %I_tenant_read on public.%I',t,t);
    execute format('create policy %I_owned_read on public.%I for select to authenticated using (organization_id = (select private.current_org_id()) and ((select private.current_role()) in (''owner'',''manager'') or ((select private.current_role()) = ''broker'' and assigned_to = (select auth.uid()))))',t,t);
  end loop;
  foreach t in array array['contact_interactions','contact_events','messages'] loop
    execute format('drop policy if exists %I_tenant_read on public.%I',t,t);
    execute format('create policy %I_contact_read on public.%I for select to authenticated using (organization_id = (select private.current_org_id()) and ((select private.current_role()) in (''owner'',''manager'') or ((select private.current_role()) = ''broker'' and exists (select 1 from public.contacts c where c.organization_id=public.%I.organization_id and c.id=public.%I.contact_id and c.assigned_to=(select auth.uid())))))',t,t,t,t);
  end loop;
  foreach t in array array['ai_lead_messages','ai_lead_qualifications'] loop
    execute format('drop policy if exists %I_tenant_read on public.%I',t,t);
  end loop;
  execute 'create policy ai_messages_session_read on public.ai_lead_messages for select to authenticated using (organization_id=(select private.current_org_id()) and ((select private.current_role()) in (''owner'',''manager'') or ((select private.current_role())=''broker'' and exists (select 1 from public.ai_lead_sessions s where s.organization_id=ai_lead_messages.organization_id and s.id=ai_lead_messages.session_id and s.assigned_to=(select auth.uid())))))';
  execute 'create policy ai_qualifications_session_read on public.ai_lead_qualifications for select to authenticated using (organization_id=(select private.current_org_id()) and ((select private.current_role()) in (''owner'',''manager'') or ((select private.current_role())=''broker'' and exists (select 1 from public.ai_lead_sessions s where s.organization_id=ai_lead_qualifications.organization_id and s.id=ai_lead_qualifications.session_id and s.assigned_to=(select auth.uid())))))';
  execute 'drop policy if exists team_invites_tenant_read on public.team_invites';
  execute 'create policy team_invites_management_read on public.team_invites for select to authenticated using (organization_id=(select private.current_org_id()) and (select private.current_role()) in (''owner'',''manager''))';
end $$;

drop policy if exists notifications_tenant_read on public.notifications;
create policy notifications_own_read on public.notifications for select to authenticated using (organization_id=(select private.current_org_id()) and user_id=(select auth.uid()));

create policy organizations_tenant_read on public.organizations for select to authenticated using (id = (select private.current_org_id()));
create policy organizations_owner_update on public.organizations for update to authenticated using (id = (select private.current_org_id()) and (select private.current_role())='owner') with check (id = (select private.current_org_id()) and (select private.current_role())='owner');

create or replace view api.attendance_queue with (security_invoker=true) as
select c.organization_id,c.id as contact_id,c.assigned_to,c.name,c.status,c.ai_status,
       greatest(c.updated_at,coalesce(max(i.happened_at),c.updated_at),coalesce(max(e.created_at),c.updated_at)) as last_activity_at,
       min(a.starts_at) filter (where a.starts_at >= now() and a.status='scheduled') as next_appointment_at,
       min(f.due_at) filter (where f.due_at >= now() and f.status in ('pending','processing')) as next_followup_at
from public.contacts c left join public.contact_interactions i on i.organization_id=c.organization_id and i.contact_id=c.id
left join public.contact_events e on e.organization_id=c.organization_id and e.contact_id=c.id
left join public.appointments a on a.organization_id=c.organization_id and a.contact_id=c.id
left join public.contact_followups f on f.organization_id=c.organization_id and f.contact_id=c.id
group by c.organization_id,c.id,c.assigned_to,c.name,c.status,c.ai_status,c.updated_at;

create or replace view api.contact_pipeline_summary with (security_invoker=true) as
select c.organization_id,c.id as contact_id,c.name,o.id as opportunity_id,o.stage,o.updated_at
from public.contacts c left join lateral (select o1.* from public.opportunities o1 where o1.organization_id=c.organization_id and o1.contact_id=c.id order by o1.updated_at desc limit 1) o on true;

do $$ declare r record;
begin
  for r in select tablename from pg_tables where schemaname='public' loop
    execute format('grant select,insert,update,delete on table public.%I to authenticated',r.tablename);
    execute format('grant all on table public.%I to imob_api_owner',r.tablename);
  end loop;
  for r in select tablename from pg_tables where schemaname='private' loop
    execute format('grant all on table private.%I to imob_api_owner',r.tablename);
  end loop;
end $$;
grant select on api.attendance_queue,api.contact_pipeline_summary to authenticated,service_role;
revoke all on all tables in schema private from public,anon,authenticated,service_role;
revoke all on all sequences in schema private from public,anon,authenticated,service_role;
revoke all on all functions in schema private from public,anon,authenticated,service_role;
grant usage on schema private to authenticated,service_role;
grant execute on function private.nonblank(text,integer) to authenticated,service_role;

revoke all on all functions in schema api from public,anon,authenticated,service_role;
grant execute on function api.site_get_settings(text),api.site_list_properties(text,integer,integer),api.site_get_property(text,uuid),api.site_list_news(text,integer,integer),api.site_get_news(text,text),api.site_list_links(text),api.site_resolve_slug_by_domain(text) to anon,authenticated;
grant execute on function api.site_create_lead(text,text,text,text,uuid,text,text,text),api.imovelweb_feed(text,text,integer),api.imovelweb_ingest(text,text,text,text,text,text,text,text,timestamptz),api.claim_internal_jobs(text,integer),api.complete_internal_job(uuid,uuid,jsonb),api.fail_internal_job(uuid,uuid,text,timestamptz) to service_role;
grant execute on function api.assign_contact(uuid,uuid,timestamptz),api.assign_opportunity(uuid,uuid,timestamptz),api.rotate_integration_credential(text,text) to authenticated;
grant execute on function private.current_org_id(),private.current_role(),private.is_owner_manager() to authenticated,service_role;
grant execute on function private.path_uuid(text) to authenticated,service_role;
