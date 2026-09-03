create table public.portal_integrations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, portal text not null check (private.nonblank(portal,60)), status text not null default 'disabled' check (status in ('enabled','disabled','error')), config jsonb not null default '{}'::jsonb, last_sync_at timestamptz, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id), unique (organization_id,portal), check (not (config ?| array['feed_token','webhook_token','access_token','secret','password']))
);
alter table public.portal_integrations enable row level security;
create trigger portal_integrations_updated_at before update on public.portal_integrations for each row execute function private.touch_updated_at();

create table public.portal_integration_runs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, portal text not null, kind text not null, status text not null, properties_count integer not null default 0 check (properties_count >= 0), bytes integer not null default 0 check (bytes >= 0), content_type text, message text, created_at timestamptz not null default now(), unique (organization_id,id)
);
alter table public.portal_integration_runs enable row level security;
create index portal_runs_created_idx on public.portal_integration_runs(organization_id,portal,created_at desc);

create table public.portal_integration_issues (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, portal text not null, property_id uuid, severity text not null check (severity in ('info','warning','error','critical')), issue_key text not null, human_message text not null, technical_message text, is_resolved boolean not null default false, resolved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id), foreign key (organization_id,property_id) references public.properties(organization_id,id) on delete restrict
);
alter table public.portal_integration_issues enable row level security;
create index portal_issues_status_idx on public.portal_integration_issues(organization_id,portal,resolved_at,severity);
create trigger portal_integration_issues_updated_at before update on public.portal_integration_issues for each row execute function private.touch_updated_at();

create table public.whatsapp_channel_settings (
  organization_id uuid primary key references public.organizations(id) on delete restrict, provider text not null default 'whatsapp', phone_number_id text, business_account_id text, display_phone text, operation_mode text not null default 'sandbox' check (operation_mode in ('sandbox','production')), status text not null default 'disconnected' check (status in ('connected','disconnected','error')), credential_last4 text, last_test_at timestamptz, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.whatsapp_channel_settings enable row level security;
create trigger whatsapp_channel_settings_updated_at before update on public.whatsapp_channel_settings for each row execute function private.touch_updated_at();

create table public.whatsapp_addon_settings (
  organization_id uuid primary key references public.organizations(id) on delete restrict, enabled boolean not null default false, currency text not null default 'BRL', included_quota integer not null default 0 check (included_quota >= 0), overage_price numeric(14,2) not null default 0 check (overage_price >= 0), billing_timezone text not null default 'America/Sao_Paulo', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.whatsapp_addon_settings enable row level security;
create trigger whatsapp_addon_settings_updated_at before update on public.whatsapp_addon_settings for each row execute function private.touch_updated_at();

create table private.integration_credentials (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, provider text not null, purpose text not null check (purpose in ('feed_auth','webhook_auth','whatsapp_access','whatsapp_verify')), secret_hash text, secret_ref text, last4 text, version integer not null check (version > 0), is_active boolean not null default true, expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id), unique (organization_id,provider,purpose,version), check ((purpose in ('feed_auth','webhook_auth') and secret_hash is not null and secret_ref is null) or (purpose in ('whatsapp_access','whatsapp_verify') and secret_ref is not null and secret_hash is null))
);
create unique index credentials_active_uq on private.integration_credentials(organization_id,provider,purpose) where is_active;
alter table private.integration_credentials enable row level security;
create trigger integration_credentials_updated_at before update on private.integration_credentials for each row execute function private.touch_updated_at();

create table private.idempotency_receipts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, provider text not null, operation text not null, dedupe_key text not null, request_hash text not null, resource_type text, resource_id uuid, result_code text not null, processed_at timestamptz not null default now(), expires_at timestamptz, unique (organization_id,id), unique (organization_id,provider,operation,dedupe_key)
);
alter table private.idempotency_receipts enable row level security;
create index receipts_processed_idx on private.idempotency_receipts(organization_id,provider,operation,processed_at desc);
create index receipts_expiry_idx on private.idempotency_receipts(expires_at);

create table private.internal_jobs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, kind text not null, dedupe_key text not null, payload jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 32000), status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')), attempts integer not null default 0 check (attempts >= 0), available_at timestamptz not null default now(), locked_at timestamptz, lock_token uuid, last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id)
);
create unique index internal_jobs_active_dedupe_uq on private.internal_jobs(organization_id,kind,dedupe_key) where status in ('queued','running');
create index internal_jobs_claimable_idx on private.internal_jobs(kind,status,available_at) where status = 'queued';
create index internal_jobs_org_dedupe_idx on private.internal_jobs(organization_id,dedupe_key) where status in ('queued','running');
alter table private.internal_jobs enable row level security;
create trigger internal_jobs_updated_at before update on private.internal_jobs for each row execute function private.touch_updated_at();

create table private.lead_distribution_state (organization_id uuid primary key references public.organizations(id) on delete cascade, last_assigned_profile_id uuid, updated_at timestamptz not null default now(), foreign key (organization_id,last_assigned_profile_id) references public.profiles(organization_id,id) on delete restrict);
create table private.property_public_code_counters (organization_id uuid primary key references public.organizations(id) on delete cascade, next_value integer not null default 1 check (next_value > 0), updated_at timestamptz not null default now());
create table private.lead_response_metrics (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, contact_id uuid not null, responder uuid, event_at timestamptz not null, response_at timestamptz, kind text not null, sla_minutes integer not null check (sla_minutes > 0), within_sla boolean, created_at timestamptz not null default now(), unique (organization_id,id), foreign key (organization_id,contact_id) references public.contacts(organization_id,id) on delete cascade, foreign key (organization_id,responder) references public.profiles(organization_id,id) on delete restrict);
create table private.whatsapp_usage_events (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, event_key text not null, channel text not null, direction text not null, units integer not null check (units > 0), period_start_date date not null, created_at timestamptz not null default now(), unique (organization_id,event_key));
create table private.whatsapp_usage_monthly (organization_id uuid not null references public.organizations(id) on delete cascade, period_start_date date not null, billing_timezone text not null, consumed_count integer not null default 0 check (consumed_count >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (organization_id,period_start_date));
create table private.seat_plans (organization_id uuid primary key references public.organizations(id) on delete cascade, seat_limit integer not null check (seat_limit >= 0), billing_cycle text not null, status text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table private.seat_plan_changes (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, action text not null, seat_limit integer check (seat_limit is null or seat_limit >= 0), effective_at timestamptz not null, status text not null, requester uuid, pricing_metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), unique (organization_id,id), foreign key (organization_id,requester) references public.profiles(organization_id,id) on delete restrict);
create table private.rate_limit_counters (scope text not null, key_hash text not null, window_start timestamptz not null, count integer not null default 0 check (count >= 0), expires_at timestamptz not null, primary key (scope,key_hash,window_start));
alter table private.lead_distribution_state enable row level security;
alter table private.property_public_code_counters enable row level security;
alter table private.lead_response_metrics enable row level security;
alter table private.whatsapp_usage_events enable row level security;
alter table private.whatsapp_usage_monthly enable row level security;
alter table private.seat_plans enable row level security;
alter table private.seat_plan_changes enable row level security;
alter table private.rate_limit_counters enable row level security;
create index rate_limit_expiry_idx on private.rate_limit_counters(expires_at);
