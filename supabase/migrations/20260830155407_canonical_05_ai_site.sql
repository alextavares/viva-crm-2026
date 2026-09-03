create table public.ai_lead_sessions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, contact_id uuid not null, assigned_to uuid,
  source text not null check (private.nonblank(source,80)), status text not null default 'active' check (status in ('active','paused','qualified','handed_off','closed')), current_step text, started_at timestamptz not null default now(), last_message_at timestamptz, qualified_at timestamptz, handoff_requested_at timestamptz, handoff_completed_at timestamptz, paused_at timestamptz, closed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,contact_id) references public.contacts(organization_id,id) on delete cascade, foreign key (organization_id,assigned_to) references public.profiles(organization_id,id) on delete restrict
);
alter table public.ai_lead_sessions enable row level security;
create index ai_sessions_owner_status_message_idx on public.ai_lead_sessions(organization_id,assigned_to,status,last_message_at desc);
create trigger ai_lead_sessions_updated_at before update on public.ai_lead_sessions for each row execute function private.touch_updated_at();

create table public.ai_lead_messages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, session_id uuid not null, author text not null check (private.nonblank(author,40)), direction text not null check (direction in ('in','out','internal')), channel text not null check (private.nonblank(channel,40)), content text not null check (private.nonblank(content,10000)), payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 16000), created_at timestamptz not null default now(), unique (organization_id,id), foreign key (organization_id,session_id) references public.ai_lead_sessions(organization_id,id) on delete cascade
);
alter table public.ai_lead_messages enable row level security;
create index ai_messages_session_created_idx on public.ai_lead_messages(organization_id,session_id,created_at);

create table public.ai_lead_qualifications (
  organization_id uuid not null references public.organizations(id) on delete restrict, session_id uuid not null, intent text, property_type text, transaction_type text check (transaction_type is null or transaction_type in ('sale','rent')), budget_min numeric(14,2) check (budget_min is null or budget_min >= 0), budget_max numeric(14,2) check (budget_max is null or budget_max >= 0), city text, neighborhoods text[] not null default '{}', timeline text, stage_score integer check (stage_score between 0 and 100), summary text, updated_at timestamptz not null default now(), primary key (organization_id,session_id), foreign key (organization_id,session_id) references public.ai_lead_sessions(organization_id,id) on delete cascade, check (budget_max is null or budget_min is null or budget_max >= budget_min)
);
alter table public.ai_lead_qualifications enable row level security;
create trigger ai_lead_qualifications_updated_at before update on public.ai_lead_qualifications for each row execute function private.touch_updated_at();

create table public.ai_lead_settings (
  organization_id uuid primary key references public.organizations(id) on delete restrict, reengagement_enabled boolean not null default false, first_delay_minutes integer not null default 5 check (first_delay_minutes between 1 and 10080), second_delay_minutes integer not null default 1440 check (second_delay_minutes between 1 and 10080), third_delay_minutes integer not null default 4320 check (third_delay_minutes between 1 and 10080), first_template_id uuid, second_template_id uuid, third_template_id uuid, response_sla_minutes integer not null default 60 check (response_sla_minutes between 1 and 10080), escalate_to_assigned boolean not null default true, notify_manager boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (first_delay_minutes < second_delay_minutes and second_delay_minutes < third_delay_minutes), foreign key (organization_id,first_template_id) references public.message_templates(organization_id,id) on delete restrict, foreign key (organization_id,second_template_id) references public.message_templates(organization_id,id) on delete restrict, foreign key (organization_id,third_template_id) references public.message_templates(organization_id,id) on delete restrict
);
alter table public.ai_lead_settings enable row level security;
create trigger ai_lead_settings_updated_at before update on public.ai_lead_settings for each row execute function private.touch_updated_at();

create table public.site_settings (
  organization_id uuid primary key references public.organizations(id) on delete restrict, theme text not null default 'default', brand_name text, headline text, description text, primary_color text check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'), secondary_color text check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'), logo_path text, public_phone text, public_email text, public_address text, analytics_id text, verification_id text, onboarding_complete boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
create trigger site_settings_updated_at before update on public.site_settings for each row execute function private.touch_updated_at();

create table public.site_pages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, key text not null check (key = lower(key) and key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), title text not null check (private.nonblank(title,200)), content jsonb not null default '{}'::jsonb, is_published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id), unique (organization_id,key)
);
alter table public.site_pages enable row level security;
create trigger site_pages_updated_at before update on public.site_pages for each row execute function private.touch_updated_at();

create table public.site_banners (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, placement text not null, variant text not null, title text, body text, image_path text, link_url text, starts_at timestamptz, ends_at timestamptz, priority integer not null default 0 check (priority >= 0), is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id), check (ends_at is null or starts_at is null or ends_at > starts_at)
);
alter table public.site_banners enable row level security;
create trigger site_banners_updated_at before update on public.site_banners for each row execute function private.touch_updated_at();

create table public.site_news (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), title text not null check (private.nonblank(title,200)), excerpt text, content jsonb not null default '{}'::jsonb, is_published boolean not null default false, published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id)
);
create unique index site_news_slug_uq on public.site_news(organization_id,lower(slug));
alter table public.site_news enable row level security;
create trigger site_news_updated_at before update on public.site_news for each row execute function private.touch_updated_at();

create table public.site_links (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, title text not null check (private.nonblank(title,200)), url text not null check (private.nonblank(url,2000)), description text, sort_order integer not null default 0 check (sort_order >= 0), is_published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id)
);
alter table public.site_links enable row level security;
create trigger site_links_updated_at before update on public.site_links for each row execute function private.touch_updated_at();

create table public.custom_domains (
  organization_id uuid primary key references public.organizations(id) on delete restrict, domain text not null check (domain = lower(domain) and private.nonblank(domain,253)), status text not null default 'pending' check (status in ('pending','verified','disabled')), last_checked_at timestamptz, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index custom_domains_domain_uq on public.custom_domains(lower(domain));
alter table public.custom_domains enable row level security;
create trigger custom_domains_updated_at before update on public.custom_domains for each row execute function private.touch_updated_at();
