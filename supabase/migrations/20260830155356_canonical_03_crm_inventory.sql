create table public.contacts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (private.nonblank(name,120)), email text, phone text, phone_normalized text,
  type text not null default 'lead' check (type in ('lead','client','owner','partner')),
  status text not null default 'new' check (status in ('new','contacted','qualified','won','lost','inactive')),
  assigned_to uuid, city text, notes text, interest_type text, interest_price_max numeric(14,2), interest_bedrooms integer,
  interest_neighborhoods text[] not null default '{}', ai_status text, ai_score integer check (ai_score between 0 and 100),
  ai_last_summary text, qualified_by_ai_at timestamptz, handoff_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,assigned_to) references public.profiles(organization_id,id) on delete restrict,
  check (interest_price_max is null or interest_price_max >= 0), check (interest_bedrooms is null or interest_bedrooms >= 0),
  check (phone_normalized is null or phone_normalized = '' or phone_normalized ~ '^\+?[0-9]{8,16}$')
);
create unique index contacts_phone_uq on public.contacts(organization_id,phone_normalized) where phone_normalized is not null and phone_normalized <> '';
create index contacts_status_owner_updated_idx on public.contacts(organization_id,status,assigned_to,updated_at desc);
create index contacts_owner_updated_idx on public.contacts(organization_id,assigned_to,updated_at desc);
alter table public.contacts enable row level security;
create trigger contacts_updated_at before update on public.contacts for each row execute function private.touch_updated_at();

create table public.properties (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  public_code text not null check (private.nonblank(public_code,80)), external_id text, title text not null check (private.nonblank(title,200)),
  description text, type text, transaction_type text not null check (transaction_type in ('sale','rent')),
  status text not null default 'draft' check (status in ('draft','available','reserved','sold','rented','inactive')),
  price numeric(14,2) check (price is null or price >= 0), built_area numeric(12,2) check (built_area is null or built_area >= 0),
  total_area numeric(12,2) check (total_area is null or total_area >= 0), financing_allowed boolean not null default false,
  address jsonb not null default '{}'::jsonb, features text[] not null default '{}', image_paths text[] not null default '{}',
  owner_contact_id uuid, owner_name text, assigned_to uuid, publish_to_site boolean not null default false,
  publish_to_portals boolean not null default false, publish_zap boolean not null default false, publish_olx boolean not null default false,
  publish_imovelweb boolean not null default false, publication_status text, publication_error text, last_published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  unique (organization_id,public_code),
  foreign key (organization_id,owner_contact_id) references public.contacts(organization_id,id) on delete restrict,
  foreign key (organization_id,assigned_to) references public.profiles(organization_id,id) on delete restrict,
  check ((not publish_zap and not publish_olx and not publish_imovelweb) or publish_to_portals)
);
create unique index properties_external_id_uq on public.properties(organization_id,external_id) where external_id is not null;
create index properties_status_owner_updated_idx on public.properties(organization_id,status,assigned_to,updated_at desc);
create index properties_site_status_updated_idx on public.properties(organization_id,publish_to_site,status,updated_at desc);
create index properties_imovelweb_status_updated_idx on public.properties(organization_id,publish_imovelweb,status,updated_at desc);
alter table public.properties enable row level security;
create trigger properties_updated_at before update on public.properties for each row execute function private.touch_updated_at();

create table public.contact_interactions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  contact_id uuid not null, created_by uuid, type text not null check (private.nonblank(type,60)), direction text not null check (direction in ('in','out','internal')),
  summary text not null check (private.nonblank(summary,2000)), metadata jsonb not null default '{}'::jsonb, happened_at timestamptz not null default now(), created_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,contact_id) references public.contacts(organization_id,id) on delete cascade,
  foreign key (organization_id,created_by) references public.profiles(organization_id,id) on delete restrict
);
alter table public.contact_interactions enable row level security;
create index contact_interactions_contact_happened_idx on public.contact_interactions(organization_id,contact_id,happened_at desc);

create table public.contact_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  contact_id uuid not null, actor_profile_id uuid, event_type text not null check (private.nonblank(event_type,80)), source text not null check (private.nonblank(source,80)),
  payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 16000), created_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,contact_id) references public.contacts(organization_id,id) on delete cascade,
  foreign key (organization_id,actor_profile_id) references public.profiles(organization_id,id) on delete restrict
);
alter table public.contact_events enable row level security;
create index contact_events_contact_created_idx on public.contact_events(organization_id,contact_id,created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  contact_id uuid not null, created_by uuid, direction text not null check (direction in ('in','out','internal')), channel text not null check (private.nonblank(channel,40)),
  body text not null check (private.nonblank(body,10000)), external_message_id text, created_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,contact_id) references public.contacts(organization_id,id) on delete cascade,
  foreign key (organization_id,created_by) references public.profiles(organization_id,id) on delete restrict
);
create unique index messages_external_uq on public.messages(organization_id,channel,external_message_id) where external_message_id is not null;
create index messages_contact_created_idx on public.messages(organization_id,contact_id,created_at desc);
alter table public.messages enable row level security;

create table public.appointments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  contact_id uuid not null, property_id uuid, assigned_to uuid, starts_at timestamptz not null, ends_at timestamptz, status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  notes text, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,contact_id) references public.contacts(organization_id,id) on delete restrict,
  foreign key (organization_id,property_id) references public.properties(organization_id,id) on delete restrict,
  foreign key (organization_id,assigned_to) references public.profiles(organization_id,id) on delete restrict,
  foreign key (organization_id,created_by) references public.profiles(organization_id,id) on delete restrict,
  check (ends_at is null or ends_at > starts_at)
);
alter table public.appointments enable row level security;
create trigger appointments_updated_at before update on public.appointments for each row execute function private.touch_updated_at();
create index appointments_owner_start_idx on public.appointments(organization_id,assigned_to,starts_at desc);
create index appointments_contact_start_idx on public.appointments(organization_id,contact_id,starts_at desc);
create index appointments_status_start_idx on public.appointments(organization_id,status,starts_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid not null, type text not null check (private.nonblank(type,60)), title text not null check (private.nonblank(title,200)), body text not null check (private.nonblank(body,2000)), link text, read_at timestamptz, created_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,user_id) references public.profiles(organization_id,id) on delete cascade
);
alter table public.notifications enable row level security;
create index notifications_user_read_created_idx on public.notifications(organization_id,user_id,read_at,created_at desc);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  title text not null check (private.nonblank(title,160)), channel text not null check (private.nonblank(channel,40)), content text not null check (private.nonblank(content,10000)), variables jsonb not null default '[]'::jsonb, created_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,created_by) references public.profiles(organization_id,id) on delete restrict
);
create unique index message_templates_title_channel_uq on public.message_templates(organization_id,lower(title),channel);
alter table public.message_templates enable row level security;
create trigger message_templates_updated_at before update on public.message_templates for each row execute function private.touch_updated_at();
