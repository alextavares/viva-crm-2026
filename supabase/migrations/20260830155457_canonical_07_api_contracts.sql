create type api.claimed_job as (id uuid, organization_id uuid, kind text, payload jsonb, lock_token uuid, available_at timestamptz);

create or replace function api.site_get_settings(p_slug text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select to_jsonb(s) - 'organization_id' from public.site_settings s join public.organizations o on o.id=s.organization_id where lower(o.slug)=lower(p_slug) and o.status='active' limit 1 $$;

create or replace function api.site_list_properties(p_slug text, p_page integer default 1, p_page_size integer default 100)
returns table(public_code text, external_id text, title text, description text, type text, transaction_type text, price numeric, built_area numeric, total_area numeric, address jsonb, features text[], image_paths text[])
language sql stable security invoker set search_path = ''
as $$
  select p.public_code,p.external_id,p.title,p.description,p.type,p.transaction_type,p.price,p.built_area,p.total_area,
         jsonb_build_object('city',p.address->'city','neighborhood',p.address->'neighborhood') as address,p.features,p.image_paths
    from public.properties p join public.organizations o on o.id=p.organization_id
   where lower(o.slug)=lower(p_slug) and o.status='active' and p.publish_to_site and p.status in ('available','reserved')
   order by p.public_code,p.id limit least(greatest(coalesce(p_page_size,100),1),100) offset (greatest(coalesce(p_page,1),1)-1)*least(greatest(coalesce(p_page_size,100),1),100)
$$;

create or replace function api.site_get_property(p_slug text, p_property_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select jsonb_build_object('public_code',p.public_code,'external_id',p.external_id,'title',p.title,'description',p.description,'type',p.type,'transaction_type',p.transaction_type,'price',p.price,'built_area',p.built_area,'total_area',p.total_area,'address',jsonb_build_object('city',p.address->'city','neighborhood',p.address->'neighborhood'),'features',p.features,'image_paths',p.image_paths) from public.properties p join public.organizations o on o.id=p.organization_id where lower(o.slug)=lower(p_slug) and p.id=p_property_id and o.status='active' and p.publish_to_site and p.status in ('available','reserved') limit 1 $$;

create or replace function api.site_list_news(p_slug text, p_page integer default 1, p_page_size integer default 100)
returns setof jsonb language sql stable security invoker set search_path = ''
as $$ select jsonb_build_object('slug',n.slug,'title',n.title,'excerpt',n.excerpt,'content',n.content,'published_at',n.published_at) from public.site_news n join public.organizations o on o.id=n.organization_id where lower(o.slug)=lower(p_slug) and o.status='active' and n.is_published and n.published_at <= now() order by n.published_at desc,n.slug limit least(greatest(coalesce(p_page_size,100),1),100) offset (greatest(coalesce(p_page,1),1)-1)*least(greatest(coalesce(p_page_size,100),1),100) $$;
create or replace function api.site_get_news(p_slug text, p_slug_key text) returns jsonb language sql stable security invoker set search_path = '' as $$ select jsonb_build_object('slug',n.slug,'title',n.title,'excerpt',n.excerpt,'content',n.content,'published_at',n.published_at) from public.site_news n join public.organizations o on o.id=n.organization_id where lower(o.slug)=lower(p_slug) and n.slug=p_slug_key and o.status='active' and n.is_published and n.published_at <= now() limit 1 $$;
create or replace function api.site_list_links(p_slug text) returns setof jsonb language sql stable security invoker set search_path = '' as $$ select jsonb_build_object('title',l.title,'url',l.url,'description',l.description,'sort_order',l.sort_order) from public.site_links l join public.organizations o on o.id=l.organization_id where lower(o.slug)=lower(p_slug) and o.status='active' and l.is_published order by l.sort_order,l.id limit 100 $$;
create or replace function api.site_resolve_slug_by_domain(p_domain text) returns text language sql stable security invoker set search_path = '' as $$ select o.slug from public.custom_domains d join public.organizations o on o.id=d.organization_id where lower(d.domain)=lower(p_domain) and d.status='verified' and o.status='active' limit 1 $$;

create or replace function api.assign_contact(p_contact_id uuid, p_new_assigned_to uuid, p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_org uuid := (select private.current_org_id()); v_role text := (select private.current_role()); v_row public.contacts;
begin
  if v_org is null or v_role not in ('owner','manager') then raise exception 'assignment denied' using errcode='42501'; end if;
  if not exists (select 1 from public.profiles p where p.organization_id=v_org and p.id=p_new_assigned_to and p.is_active and p.role='broker') then raise exception 'assignee must be an active tenant broker'; end if;
  update public.contacts set assigned_to=p_new_assigned_to where id=p_contact_id and organization_id=v_org and updated_at=p_expected_updated_at returning * into v_row;
  if not found then raise exception 'contact not found or stale' using errcode='40001'; end if;
  return jsonb_build_object('id',v_row.id,'assigned_to',v_row.assigned_to,'updated_at',v_row.updated_at);
end $$;
alter function api.assign_contact(uuid,uuid,timestamptz) owner to imob_api_owner;

create or replace function api.assign_opportunity(p_opportunity_id uuid, p_new_assigned_to uuid, p_expected_updated_at timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$ declare v_org uuid := (select private.current_org_id()); v_role text := (select private.current_role()); v_row public.opportunities; begin
  if v_org is null or v_role not in ('owner','manager') then raise exception 'assignment denied' using errcode='42501'; end if;
  if not exists (select 1 from public.profiles p where p.organization_id=v_org and p.id=p_new_assigned_to and p.is_active and p.role='broker') then raise exception 'assignee must be an active tenant broker'; end if;
  update public.opportunities set assigned_to=p_new_assigned_to where id=p_opportunity_id and organization_id=v_org and updated_at=p_expected_updated_at returning * into v_row;
  if not found then raise exception 'opportunity not found or stale' using errcode='40001'; end if;
  return jsonb_build_object('id',v_row.id,'assigned_to',v_row.assigned_to,'updated_at',v_row.updated_at);
end $$;
alter function api.assign_opportunity(uuid,uuid,timestamptz) owner to imob_api_owner;

create or replace function api.rotate_integration_credential(p_provider text, p_purpose text)
returns table(credential_id uuid, secret_once text, last4 text)
language plpgsql security definer set search_path = ''
as $$
declare v_org uuid := (select private.current_org_id()); v_role text := (select private.current_role()); v_secret text := encode(extensions.gen_random_bytes(32),'hex'); v_id uuid; v_version integer;
begin
  if v_org is null or v_role not in ('owner','manager') then raise exception 'credential rotation denied' using errcode='42501'; end if;
  if p_purpose not in ('feed_auth','webhook_auth','whatsapp_access','whatsapp_verify') then raise exception 'unsupported credential purpose'; end if;
  v_id := gen_random_uuid();
  select coalesce(max(c.version),0)+1 into v_version from private.integration_credentials c where c.organization_id=v_org and c.provider=p_provider and c.purpose=p_purpose;
  update private.integration_credentials set is_active=false,updated_at=now() where organization_id=v_org and provider=p_provider and purpose=p_purpose and is_active;
  insert into private.integration_credentials(id,organization_id,provider,purpose,secret_hash,secret_ref,last4,version) values (v_id,v_org,p_provider,p_purpose,case when p_purpose in ('feed_auth','webhook_auth') then extensions.crypt(v_secret,extensions.gen_salt('bf')) end,case when p_purpose in ('whatsapp_access','whatsapp_verify') then 'external://pending/'||v_id::text end,right(v_secret,4),v_version);
  credential_id := v_id; secret_once := v_secret; last4 := right(v_secret,4); return next;
end $$;
alter function api.rotate_integration_credential(text,text) owner to imob_api_owner;

create or replace function api.site_create_lead(p_slug text, p_name text, p_phone text, p_email text, p_property_id uuid, p_message text, p_source_domain text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_org uuid; v_contact uuid; v_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'); v_receipt private.idempotency_receipts;
begin
  if length(p_name)>120 or length(p_phone)>32 or length(coalesce(p_email,''))>254 or length(coalesce(p_message,''))>2000 or length(coalesce(p_idempotency_key,''))>200 then raise exception 'lead payload too large'; end if;
  select id into v_org from public.organizations where lower(slug)=lower(p_slug) and status='active'; if v_org is null then raise exception 'unknown organization'; end if;
  insert into private.idempotency_receipts(organization_id,provider,operation,dedupe_key,request_hash,result_code,expires_at) values(v_org,'site','create_lead',p_idempotency_key,encode(extensions.digest(coalesce(p_name,'')||coalesce(p_phone,'')||coalesce(p_message,''),'sha256'),'hex'),'accepted',now()+interval '30 days') on conflict do nothing returning * into v_receipt;
  if v_receipt.id is null then return jsonb_build_object('accepted',true,'deduped',true,'reference',p_idempotency_key); end if;
  if p_property_id is not null and not exists(select 1 from public.properties where id=p_property_id and organization_id=v_org and publish_to_site and status in ('available','reserved')) then raise exception 'property unavailable'; end if;
  insert into public.contacts(organization_id,name,email,phone,phone_normalized,status) values(v_org,btrim(p_name),nullif(btrim(p_email),''),p_phone,nullif(v_phone,''),'new') returning id into v_contact;
  insert into public.contact_events(organization_id,contact_id,event_type,source,payload) values(v_org,v_contact,'site_lead',coalesce(p_source_domain,'site'),jsonb_build_object('property_id',p_property_id,'message',left(coalesce(p_message,''),2000)));
  update private.idempotency_receipts set resource_type='contact',resource_id=v_contact where id=v_receipt.id;
  return jsonb_build_object('accepted',true,'deduped',false,'reference',v_contact);
end $$;
alter function api.site_create_lead(text,text,text,text,uuid,text,text,text) owner to imob_api_owner;

create or replace function api.imovelweb_feed(p_slug text, p_feed_secret text, p_max_rows integer default 5000)
returns table(external_id text, public_code text, title text, description text, type text, transaction_type text, price numeric, built_area numeric, total_area numeric, address jsonb, image_paths text[], publication_status text)
language sql stable security definer set search_path = ''
as $$ select p.external_id,p.public_code,p.title,p.description,p.type,p.transaction_type,p.price,p.built_area,p.total_area,jsonb_build_object('city',p.address->'city','neighborhood',p.address->'neighborhood') as address,p.image_paths,p.publication_status from public.properties p join public.organizations o on o.id=p.organization_id join private.integration_credentials c on c.organization_id=o.id and c.provider='imovelweb' and c.purpose='feed_auth' and c.is_active where lower(o.slug)=lower(p_slug) and extensions.crypt(p_feed_secret,c.secret_hash)=c.secret_hash and p.publish_imovelweb and p.status in ('available','reserved') order by p.public_code,p.id limit least(greatest(coalesce(p_max_rows,5000),1),5000) $$;
alter function api.imovelweb_feed(text,text,integer) owner to imob_api_owner;

create or replace function api.imovelweb_ingest(p_slug text, p_webhook_secret text, p_event_id text, p_name text, p_phone text, p_email text, p_message text, p_listing_ref text, p_received_at timestamptz)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_org uuid; v_contact uuid; v_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'); v_receipt private.idempotency_receipts;
begin
  if length(coalesce(p_event_id,''))=0 or length(p_name)>120 or length(p_phone)>32 or length(coalesce(p_email,''))>254 or length(coalesce(p_message,''))>2000 or length(v_phone) not between 8 and 16 then raise exception 'invalid bounded webhook payload'; end if;
  select o.id into v_org from public.organizations o join private.integration_credentials c on c.organization_id=o.id and c.provider='imovelweb' and c.purpose='webhook_auth' and c.is_active where lower(o.slug)=lower(p_slug) and extensions.crypt(p_webhook_secret,c.secret_hash)=c.secret_hash;
  if v_org is null then raise exception 'invalid webhook credential' using errcode='42501'; end if;
  insert into private.idempotency_receipts(organization_id,provider,operation,dedupe_key,request_hash,result_code,expires_at) values(v_org,'imovelweb','webhook',p_event_id,encode(extensions.digest(coalesce(p_name,'')||v_phone||coalesce(p_listing_ref,''),'sha256'),'hex'),'accepted',now()+interval '90 days') on conflict do nothing returning * into v_receipt;
  if v_receipt.id is null then return jsonb_build_object('accepted',true,'deduped',true,'reference',p_event_id); end if;
  select id into v_contact from public.contacts where organization_id=v_org and phone_normalized=v_phone limit 1;
  if v_contact is null then insert into public.contacts(organization_id,name,email,phone,phone_normalized,status) values(v_org,btrim(p_name),nullif(btrim(p_email),''),p_phone,v_phone,'new') returning id into v_contact; end if;
  insert into public.contact_events(organization_id,contact_id,event_type,source,payload) values(v_org,v_contact,'imovelweb_webhook','imovelweb',jsonb_build_object('event_id',p_event_id,'listing_ref',left(coalesce(p_listing_ref,''),200),'received_at',p_received_at));
  insert into public.messages(organization_id,contact_id,direction,channel,body,external_message_id) values(v_org,v_contact,'in','imovelweb',left(coalesce(p_message,''),10000),p_event_id);
  update private.idempotency_receipts set resource_type='contact',resource_id=v_contact where id=v_receipt.id;
  return jsonb_build_object('accepted',true,'deduped',false,'reference',v_contact);
end $$;
alter function api.imovelweb_ingest(text,text,text,text,text,text,text,text,timestamptz) owner to imob_api_owner;

create or replace function api.claim_internal_jobs(p_kind text, p_max_jobs integer)
returns setof api.claimed_job language plpgsql security definer set search_path = ''
as $$ begin if p_max_jobs not between 1 and 100 then raise exception 'max_jobs out of bounds'; end if; return query update private.internal_jobs j set status='running',locked_at=now(),lock_token=gen_random_uuid(),attempts=j.attempts+1,updated_at=now() where j.id in (select q.id from private.internal_jobs q where q.kind=p_kind and q.status='queued' and q.available_at<=now() order by q.available_at for update skip locked limit p_max_jobs) returning j.id,j.organization_id,j.kind,j.payload,j.lock_token,j.available_at; end $$;
alter function api.claim_internal_jobs(text,integer) owner to imob_api_owner;
create or replace function api.complete_internal_job(p_job_id uuid,p_lock_token uuid,p_result jsonb) returns void language plpgsql security definer set search_path = '' as $$ begin update private.internal_jobs set status='completed',payload=coalesce(p_result,'{}'::jsonb),locked_at=null,lock_token=null,updated_at=now() where id=p_job_id and lock_token=p_lock_token and status='running'; if not found then raise exception 'job lock mismatch'; end if; end $$;
alter function api.complete_internal_job(uuid,uuid,jsonb) owner to imob_api_owner;
create or replace function api.fail_internal_job(p_job_id uuid,p_lock_token uuid,p_error_code text,p_retry_at timestamptz) returns void language plpgsql security definer set search_path = '' as $$ begin update private.internal_jobs set status=case when attempts>=5 then 'failed' else 'queued' end,last_error=left(p_error_code,200),available_at=coalesce(p_retry_at,now()),locked_at=null,lock_token=null,updated_at=now() where id=p_job_id and lock_token=p_lock_token and status='running'; if not found then raise exception 'job lock mismatch'; end if; end $$;
alter function api.fail_internal_job(uuid,uuid,text,timestamptz) owner to imob_api_owner;

grant select on public.site_settings,public.site_news,public.site_links,public.properties,public.organizations to imob_api_owner;
grant select,insert,update on public.contacts,public.contact_events,public.messages to imob_api_owner;
grant select,insert,update on private.integration_credentials,private.idempotency_receipts,private.internal_jobs to imob_api_owner;
