create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (private.nonblank(name, 160)),
  slug text not null check (slug = lower(slug) and private.nonblank(slug, 80)),
  status text not null default 'active' check (status in ('active','suspended')),
  plan_code text not null default 'starter' check (private.nonblank(plan_code, 40)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id)
);
create unique index organizations_slug_lower_uq on public.organizations (lower(slug));
alter table public.organizations enable row level security;
create trigger organizations_updated_at before update on public.organizations for each row execute function private.touch_updated_at();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  full_name text not null check (private.nonblank(full_name, 160)),
  email text check (email is null or length(email) <= 254),
  role text not null check (role in ('owner','manager','broker','assistant')),
  is_active boolean not null default true,
  avatar_path text,
  public_profile_enabled boolean not null default false,
  public_display_name text,
  public_whatsapp text,
  creci text,
  response_time_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id)
);
create unique index profiles_email_uq on public.profiles (organization_id, lower(email)) where email is not null;
create index profiles_organization_id_idx on public.profiles (organization_id);
alter table public.profiles enable row level security;
create trigger profiles_updated_at before update on public.profiles for each row execute function private.touch_updated_at();

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  email text not null check (length(email) between 3 and 254),
  role text not null check (role in ('manager','broker','assistant')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_profile_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id, invited_by) references public.profiles(organization_id,id) on delete restrict,
  foreign key (organization_id, accepted_profile_id) references public.profiles(organization_id,id) on delete restrict
);
create unique index team_invites_pending_email_uq on public.team_invites (organization_id, lower(email)) where status = 'pending';
create index team_invites_status_expiry_idx on public.team_invites (organization_id,status,expires_at);
alter table public.team_invites enable row level security;
create trigger team_invites_updated_at before update on public.team_invites for each row execute function private.touch_updated_at();

create table public.team_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_profile_id uuid,
  target_profile_id uuid,
  action text not null check (private.nonblank(action, 80)),
  level text not null default 'info' check (level in ('info','warning','critical')),
  message text not null check (private.nonblank(message, 500)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id,id),
  foreign key (organization_id, actor_profile_id) references public.profiles(organization_id,id) on delete restrict,
  foreign key (organization_id, target_profile_id) references public.profiles(organization_id,id) on delete restrict
);
alter table public.team_audit_events enable row level security;

create or replace function private.current_org_id()
returns uuid language sql stable security definer set search_path = ''
as $$ select p.organization_id from public.profiles p where p.id = (select auth.uid()) and p.is_active limit 1 $$;
alter function private.current_org_id() owner to imob_api_owner;
create or replace function private.current_role()
returns text language sql stable security definer set search_path = ''
as $$ select p.role from public.profiles p where p.id = (select auth.uid()) and p.is_active limit 1 $$;
alter function private.current_role() owner to imob_api_owner;
create or replace function private.is_owner_manager()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select private.current_role()) in ('owner','manager'), false) $$;
alter function private.is_owner_manager() owner to imob_api_owner;
create or replace function private.is_authenticated_user()
returns boolean language sql stable
as $$ select (select auth.uid()) is not null $$;

grant select on public.profiles to imob_api_owner;
grant insert, update on public.organizations, public.profiles to imob_api_owner;
grant select, insert, update, delete on public.team_invites, public.team_audit_events to imob_api_owner;

create table private.invite_tokens (
  invite_id uuid primary key references public.team_invites(id) on delete cascade,
  token_hash bytea not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  unique (token_hash)
);
alter table private.invite_tokens enable row level security;

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_invite public.team_invites%rowtype;
  v_org uuid;
  v_role text := 'owner';
  v_token text := new.raw_user_meta_data->>'invite_token';
begin
  if v_token is not null and length(v_token) > 0 then
    select i.* into v_invite
      from private.invite_tokens t join public.team_invites i on i.id = t.invite_id
     where t.token_hash = extensions.digest(v_token, 'sha256')
       and t.consumed_at is null and t.expires_at > now()
       and lower(i.email) = lower(new.email)
       and i.status = 'pending'
     for update of t, i;
    if not found then raise exception 'invalid or expired invite'; end if;
    v_org := v_invite.organization_id;
    v_role := v_invite.role;
    update private.invite_tokens set consumed_at = now() where invite_id = v_invite.id;
    update public.team_invites set status = 'accepted', accepted_at = now(), accepted_profile_id = new.id where id = v_invite.id;
  else
    insert into public.organizations(name,slug) values ('Synthetic workspace', 'org-' || replace(new.id::text,'-','')) returning id into v_org;
  end if;

  insert into public.profiles(id,organization_id,full_name,email,role)
  values (new.id,v_org,coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1)),new.email,v_role);
  new.raw_user_meta_data := new.raw_user_meta_data - 'invite_token' - 'role' - 'organization_id';
  return new;
end;
$$;
alter function private.handle_new_user() owner to imob_api_owner;
grant insert, update on private.invite_tokens to imob_api_owner;
revoke all on function private.handle_new_user() from public, anon, authenticated, service_role;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created before insert on auth.users for each row execute function private.handle_new_user();
