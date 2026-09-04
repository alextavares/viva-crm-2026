-- Synthetic-only local seed. All identities, domains, labels and credentials are
-- intentionally non-production and use .invalid addresses.
do $$
declare
  v_org uuid;
  v_owner uuid := '00000000-0000-0000-0000-000000000001';
  v_tenant_b uuid := '00000000-0000-0000-0000-000000000101';
  v_id uuid;
  v_invite uuid;
  v_role text;
  v_email text;
  v_token text;
  v_instance uuid;
begin
  select id into v_instance from auth.instances limit 1;

  update auth.users set instance_id=v_instance
  where instance_id is null and id in (v_owner,v_tenant_b,
    '00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000013');
  update auth.users set raw_app_meta_data='{"provider":"email","providers":["email"]}'
  where (raw_app_meta_data->>'provider') is null and email like '%@synthetic%.invalid';

  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select v_instance,v_owner,'authenticated','authenticated','owner@synthetic-a.invalid',extensions.crypt('SyntheticOnlyOwner',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Synthetic Owner"}',now(),now()
  where not exists (select 1 from auth.users where id=v_owner);
  insert into auth.identities(id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  select gen_random_uuid(),v_owner,jsonb_build_object('sub',v_owner::text,'email','owner@synthetic-a.invalid','email_verified',false,'phone_verified',false),'email','owner@synthetic-a.invalid',now(),now(),now()
  where not exists (select 1 from auth.identities where user_id=v_owner and provider='email');
  select organization_id into v_org from public.profiles where id=v_owner;
  update public.organizations set name='Synthetic Tenant A',slug='synthetic-tenant-a' where id=v_org;

  foreach v_role in array array['manager','broker','assistant'] loop
    v_id := ('00000000-0000-0000-0000-' || lpad((10 + array_position(array['manager','broker','assistant'],v_role))::text,12,'0'))::uuid;
    v_email := v_role || '@synthetic-a.invalid'; v_token := 'SyntheticInvite-' || v_role;
    v_invite := null;
    insert into public.team_invites(organization_id,email,role,expires_at) values(v_org,v_email,v_role,now()+interval '7 days') on conflict do nothing returning id into v_invite;
    if v_invite is not null then insert into private.invite_tokens(invite_id,token_hash,expires_at) values(v_invite,extensions.digest(v_token,'sha256'),now()+interval '7 days') on conflict do nothing; end if;
    v_id := ('00000000-0000-0000-0000-' || lpad((10 + array_position(array['manager','broker','assistant'],v_role))::text,12,'0'))::uuid;
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
    select v_instance,v_id,'authenticated','authenticated',v_email,extensions.crypt('SyntheticOnlyPassword',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',jsonb_build_object('full_name','Synthetic '||initcap(v_role),'invite_token',v_token),now(),now()
    where not exists (select 1 from auth.users where id=v_id);
    insert into auth.identities(id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
    select gen_random_uuid(),v_id,jsonb_build_object('sub',v_id::text,'email',v_email,'email_verified',false,'phone_verified',false),'email',v_email,now(),now(),now()
    where not exists (select 1 from auth.identities where user_id=v_id and provider='email');
  end loop;

  insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select v_instance,v_tenant_b,'authenticated','authenticated','owner@synthetic-b.invalid',extensions.crypt('SyntheticOnlyOwnerB',extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Synthetic Owner B"}',now(),now()
  where not exists (select 1 from auth.users where id=v_tenant_b);
  insert into auth.identities(id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  select gen_random_uuid(),v_tenant_b,jsonb_build_object('sub',v_tenant_b::text,'email','owner@synthetic-b.invalid','email_verified',false,'phone_verified',false),'email','owner@synthetic-b.invalid',now(),now(),now()
  where not exists (select 1 from auth.identities where user_id=v_tenant_b and provider='email');
  select organization_id into v_id from public.profiles where id=v_tenant_b;
  update public.organizations set name='Synthetic Tenant B',slug='synthetic-tenant-b' where id=v_id;

  insert into public.site_settings(organization_id,brand_name,headline,description,primary_color,secondary_color) values(v_org,'Synthetic Imob A','Synthetic listings','Local-only synthetic content','#112233','#445566') on conflict (organization_id) do nothing;
  insert into public.site_settings(organization_id,brand_name,headline,description,primary_color,secondary_color) values(v_id,'Synthetic Imob B','Synthetic listings B','Local-only synthetic content','#223344','#556677') on conflict (organization_id) do nothing;
  insert into public.contacts(id,organization_id,name,email,phone,phone_normalized,status) values('10000000-0000-0000-0000-000000000001',v_org,'Synthetic Contact','contact@synthetic-a.invalid','+5511999990001','+5511999990001','qualified') on conflict do nothing;
  insert into public.properties(id,organization_id,public_code,title,transaction_type,status,price,address,publish_to_site,publish_to_portals,publish_imovelweb) values('20000000-0000-0000-0000-000000000001',v_org,'SYN-A-001','Synthetic Apartment','sale','available',100000,jsonb_build_object('city','Synthetic City','neighborhood','Synthetic Neighborhood'),true,true,true) on conflict do nothing;
  insert into public.opportunities(id,organization_id,contact_id,property_id,stage,estimated_value) values('30000000-0000-0000-0000-000000000001',v_org,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','qualified',100000) on conflict do nothing;
  insert into private.integration_credentials(organization_id,provider,purpose,secret_hash,last4,version) values(v_org,'imovelweb','feed_auth',extensions.crypt('SyntheticOnlyFeedCredential',extensions.gen_salt('bf')),'ntial',1),(v_org,'imovelweb','webhook_auth',extensions.crypt('SyntheticOnlyWebhookCredential',extensions.gen_salt('bf')),'ntial',1) on conflict do nothing;
end $$;
