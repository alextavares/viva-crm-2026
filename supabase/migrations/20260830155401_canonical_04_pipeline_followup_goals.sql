create table public.opportunities (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  contact_id uuid not null, property_id uuid, assigned_to uuid, stage text not null default 'new' check (stage in ('new','qualified','visit','negotiation','proposal','won','lost')),
  source text, estimated_value numeric(14,2) check (estimated_value is null or estimated_value >= 0), expected_close_date date, loss_reason text, closed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,contact_id) references public.contacts(organization_id,id) on delete restrict,
  foreign key (organization_id,property_id) references public.properties(organization_id,id) on delete restrict,
  foreign key (organization_id,assigned_to) references public.profiles(organization_id,id) on delete restrict,
  check ((stage in ('won','lost')) = (closed_at is not null)), check (stage <> 'lost' or private.nonblank(loss_reason,500))
);
create unique index opportunities_active_contact_property_uq on public.opportunities(organization_id,contact_id,coalesce(property_id,'00000000-0000-0000-0000-000000000000'::uuid)) where closed_at is null;
create index opportunities_owner_stage_updated_idx on public.opportunities(organization_id,assigned_to,stage,updated_at desc);
create index opportunities_contact_updated_idx on public.opportunities(organization_id,contact_id,updated_at desc);
alter table public.opportunities enable row level security;
create trigger opportunities_updated_at before update on public.opportunities for each row execute function private.touch_updated_at();

create table public.proposals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null, assigned_to uuid, amount numeric(14,2) not null check (amount >= 0), payment_terms text, valid_until date, status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired','cancelled')), notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id), unique (organization_id,opportunity_id,id),
  foreign key (organization_id,opportunity_id) references public.opportunities(organization_id,id) on delete restrict,
  foreign key (organization_id,assigned_to) references public.profiles(organization_id,id) on delete restrict
);
create index proposals_opportunity_created_idx on public.proposals(organization_id,opportunity_id,created_at desc);
alter table public.proposals enable row level security;
create trigger proposals_updated_at before update on public.proposals for each row execute function private.touch_updated_at();

create table public.contracts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict,
  opportunity_id uuid not null, accepted_proposal_id uuid, assigned_to uuid, contract_type text not null check (contract_type in ('sale','rent')), amount numeric(14,2) not null check (amount >= 0), commission_amount numeric(14,2) check (commission_amount is null or commission_amount >= 0), starts_at timestamptz, ends_at timestamptz, status text not null default 'draft' check (status in ('draft','signed','active','completed','cancelled')), document_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,opportunity_id) references public.opportunities(organization_id,id) on delete restrict,
  foreign key (organization_id,opportunity_id,accepted_proposal_id) references public.proposals(organization_id,opportunity_id,id) on delete restrict,
  foreign key (organization_id,assigned_to) references public.profiles(organization_id,id) on delete restrict,
  check (ends_at is null or starts_at is null or ends_at > starts_at), check (status not in ('signed','active') or accepted_proposal_id is not null)
);
create unique index contracts_accepted_proposal_uq on public.contracts(organization_id,accepted_proposal_id) where accepted_proposal_id is not null;
create index contracts_owner_status_updated_idx on public.contracts(organization_id,assigned_to,status,updated_at desc);
alter table public.contracts enable row level security;
create trigger contracts_updated_at before update on public.contracts for each row execute function private.touch_updated_at();

create table public.lead_distribution_settings (
  organization_id uuid primary key references public.organizations(id) on delete restrict, enabled boolean not null default false,
  mode text not null default 'manual' check (mode in ('manual','round_robin','default')), default_assigned_to uuid, sla_minutes integer not null default 15 check (sla_minutes between 1 and 10080), redistribute_overdue boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id,default_assigned_to) references public.profiles(organization_id,id) on delete restrict
);
alter table public.lead_distribution_settings enable row level security;
create trigger lead_distribution_settings_updated_at before update on public.lead_distribution_settings for each row execute function private.touch_updated_at();

create table public.contact_followups (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, contact_id uuid not null, assigned_to uuid, template_id uuid, step integer not null check (step > 0), due_at timestamptz not null, status text not null default 'pending' check (status in ('pending','processing','completed','cancelled')), source text, completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id),
  foreign key (organization_id,contact_id) references public.contacts(organization_id,id) on delete cascade,
  foreign key (organization_id,assigned_to) references public.profiles(organization_id,id) on delete restrict,
  foreign key (organization_id,template_id) references public.message_templates(organization_id,id) on delete restrict
);
create unique index contact_followups_active_step_uq on public.contact_followups(organization_id,contact_id,step) where status in ('pending','processing');
create index contact_followups_status_due_idx on public.contact_followups(organization_id,status,due_at);
create index contact_followups_owner_status_due_idx on public.contact_followups(organization_id,assigned_to,status,due_at);
alter table public.contact_followups enable row level security;
create trigger contact_followups_updated_at before update on public.contact_followups for each row execute function private.touch_updated_at();

create table public.followup_settings (
  organization_id uuid primary key references public.organizations(id) on delete restrict, enabled boolean not null default false, step_5m_template uuid, step_24h_template uuid, step_3d_template uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (organization_id,step_5m_template) references public.message_templates(organization_id,id) on delete restrict,
  foreign key (organization_id,step_24h_template) references public.message_templates(organization_id,id) on delete restrict,
  foreign key (organization_id,step_3d_template) references public.message_templates(organization_id,id) on delete restrict
);
alter table public.followup_settings enable row level security;
create trigger followup_settings_updated_at before update on public.followup_settings for each row execute function private.touch_updated_at();

create table public.goal_settings (
  organization_id uuid primary key references public.organizations(id) on delete restrict, enabled boolean not null default false, period_type text not null default 'monthly' check (period_type in ('monthly','quarterly')),
  contacts_enabled boolean not null default false, contacts_target integer not null default 0 check (contacts_target >= 0), appointments_enabled boolean not null default false, appointments_target integer not null default 0 check (appointments_target >= 0), contracts_enabled boolean not null default false, contracts_target integer not null default 0 check (contracts_target >= 0), response_sla_minutes integer not null default 60 check (response_sla_minutes between 1 and 10080), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.goal_settings enable row level security;
create trigger goal_settings_updated_at before update on public.goal_settings for each row execute function private.touch_updated_at();

create table public.goal_profile_overrides (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete restrict, profile_id uuid not null, enabled boolean not null default true, period_type text not null default 'monthly' check (period_type in ('monthly','quarterly')), contacts_target integer not null default 0 check (contacts_target >= 0), appointments_target integer not null default 0 check (appointments_target >= 0), contracts_target integer not null default 0 check (contracts_target >= 0), response_sla_minutes integer not null default 60 check (response_sla_minutes between 1 and 10080), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id,id), unique (organization_id,profile_id), foreign key (organization_id,profile_id) references public.profiles(organization_id,id) on delete restrict
);
alter table public.goal_profile_overrides enable row level security;
create trigger goal_profile_overrides_updated_at before update on public.goal_profile_overrides for each row execute function private.touch_updated_at();
