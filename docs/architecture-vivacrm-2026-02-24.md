# System Architecture: VivaCRM

**Document Version:** 1.0  
**Date:** 2026-02-24  
**Author:** System Architect  
**Status:** Draft

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Pattern](#2-architecture-pattern)
3. [Component Design](#3-component-design)
4. [Data Model](#4-data-model)
5. [API Specifications](#5-api-specifications)
6. [Non-Functional Requirements Mapping](#6-non-functional-requirements-mapping)
7. [Technology Stack](#7-technology-stack)
8. [Trade-off Analysis](#8-trade-off-analysis)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Future Considerations](#10-future-considerations)

---

## 1. System Overview

### Purpose
VivaCRM is a multi-tenant real-estate CRM with a conversion-focused public site. It centralizes leads, properties, appointments, automations, and portal feeds while keeping tenant isolation enforced in data access.

### Scope
**In Scope:**
- CRM dashboard modules: properties, contacts, appointments, settings, integrations.
- Public tenant site with domain/slug resolution and lead capture.
- Lead operations: round-robin assignment, SLA status, follow-up automation, goals dashboard.
- Portal feed export and lead webhook ingestion.

**Out of Scope:**
- Deep AI copilots and autonomous outbound messaging.
- Social/video automation and enterprise BI.
- Full microservices decomposition in this cycle.

### Architectural Drivers
1. **NFR-003 Multi-tenant security** - strict tenant isolation via RLS + SECURITY DEFINER RPC boundaries.
2. **NFR-002 Asynchronous scalability** - follow-up/SLA workloads must run via queue-like jobs, not synchronous UI paths.
3. **NFR-001 Operational performance** - CRM list/filter UX must stay responsive under tenant growth.

### Stakeholders
- **Users:** owners/managers/brokers/assistants and public leads.
- **Developers:** single codebase team shipping fast with strong guardrails.
- **Operations:** Vercel deployment + Supabase managed backend.
- **Business:** low-touch SaaS model, with optional paid add-ons (e.g. WhatsApp official integration).

---

## 2. Architecture Pattern

### Selected Pattern
**Pattern:** Modular Monolith (Next.js app + Supabase backend)

### Pattern Justification
**Why this pattern:**
- Project complexity is Level 2 with fast iteration requirements.
- Single deployable app reduces operational overhead versus early microservices.
- Domain modules are already naturally separable and can be extracted later.

**Alternatives considered:**
- **Microservices:** rejected now due to operational cost/complexity overhead.
- **Pure serverless function mesh:** rejected due to increased orchestration complexity for transactional CRM workflows.

### Pattern Application
- UI and API run in one Next.js application.
- Business/data rules are split into domain modules and database RPCs.
- Multi-tenant isolation is pushed down to database policies and helper functions.
- Background-like jobs are exposed through secure API routes and RPC processors.

---

## 3. Component Design

### Component Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               Client Layer                                 │
│  Dashboard (CRM)                  Public Site (tenant/domain/slug)         │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────────┐
│                           Next.js Application                               │
│  App Router pages + API routes + middleware (auth + host/domain rewrite)   │
└───────────────┬───────────────────────┬───────────────────────┬────────────┘
                │                       │                       │
┌───────────────▼──────────────┐ ┌─────▼────────────────┐ ┌───▼────────────────┐
│ Supabase Auth + RLS          │ │ Supabase Postgres    │ │ Supabase Storage   │
│ Session + role/org checks    │ │ Tables + RPCs        │ │ site-assets bucket │
└───────────────┬──────────────┘ └─────┬────────────────┘ └───┬────────────────┘
                │                      │                      │
                └──────────────┬───────┴───────┬──────────────┘
                               │               │
                     ┌─────────▼───────┐ ┌────▼──────────────────┐
                     │ Portal Feed APIs │ │ Webhook Ingestion APIs │
                     └──────────────────┘ └────────────────────────┘
```

### Component Descriptions

#### Component: Dashboard CRM
**Responsibility:** Internal authenticated workspace for operations and management.

**Interfaces Provided:**
- `/dashboard`, `/properties`, `/contacts`, `/appointments`, `/settings/*`, `/integrations/*`
- Internal actions via Next.js route handlers.

**Interfaces Required:**
- Supabase authenticated client.
- RPCs for goals, lead distribution, follow-ups, settings, and feed diagnostics.

**Data Owned:**
- Operational views over `properties`, `contacts`, `appointments`, `messages`, `contact_events`.

**NFRs Addressed:**
- NFR-001 performance through server-side filtering + debounced client search.
- NFR-004 observability via timeline events and explicit status surfaces.

#### Component: Public Site Delivery
**Responsibility:** Serve tenant websites with clean URLs and capture inbound leads.

**Interfaces Provided:**
- `/s/[slug]/*` routes and clean-domain rewrites.
- Content pages (`about`, `contact`, `lgpd`, `noticias`, `links`, `imovel/[id]`).

**Interfaces Required:**
- Host/domain resolution (`site_resolve_slug_by_domain`).
- Public RPCs (`site_get_settings`, `site_list_properties`, `site_get_property`, `site_create_lead`, `site_list_news`, `site_get_news`, `site_list_links`).

**Data Owned:**
- Read access to tenant-public data and write path for lead creation events.

**NFRs Addressed:**
- NFR-006 mobile-first lead conversion UX.
- NFR-003 tenant-safe read/write through RPC boundary.

#### Component: Lead Automation Engine
**Responsibility:** Schedule and process follow-up jobs and SLA redistributions.

**Interfaces Provided:**
- `/api/jobs/followups/process`
- `/api/jobs/leads/redistribute`
- settings screens under `/settings/followup` and `/settings/leads`.

**Interfaces Required:**
- RPCs: `followup_schedule_sequence`, `followup_process_due`, `lead_assign_next_broker`, `lead_redistribute_overdue`.

**Data Owned:**
- `followup_settings`, `followup_jobs`, `lead_distribution_settings`, `lead_distribution_state`.

**NFRs Addressed:**
- NFR-002 async processing with bounded batch limits.
- NFR-005 idempotent processing via unique constraints and status transitions.

#### Component: Integrations Gateway
**Responsibility:** Outbound feed generation and inbound lead ingestion.

**Interfaces Provided:**
- `/api/feeds/[portal]/[token]`
- `/api/webhooks/leads/[token]`
- `/api/integrations/run`.

**Interfaces Required:**
- RPCs: `feed_properties`, `webhook_ingest_lead`, `webhook_create_endpoint`.
- Integration state tables (`portal_integrations`, runs, issues).

**Data Owned:**
- Integration operational metadata and event logs.

**NFRs Addressed:**
- NFR-004 diagnostics and traceability for sync runs/issues.
- NFR-003 token-scoped and tenant-scoped ingestion rules.

---

## 4. Data Model

### Core Entity Groups

1. **Tenant and access**
- `organizations`, `profiles`, `custom_domains`

2. **CRM operations**
- `properties` (+ `property_public_code_sequences`)
- `contacts`
- `appointments`
- `messages`
- `contact_events`

3. **Public site CMS**
- `site_settings`
- `site_pages`
- `site_banners`
- `site_news`
- `site_links`

4. **Automation and distribution**
- `followup_settings`
- `followup_jobs`
- `lead_distribution_settings`
- `lead_distribution_state`
- `goal_settings`
- `goal_broker_overrides`
- `lead_response_metrics`

5. **Integrations**
- `portal_integrations`
- `portal_integration_runs`
- `portal_integration_issues`
- `webhook_endpoints`

### Relationship Highlights
- `organization` is the root boundary for all tenant-scoped entities.
- `profiles` map auth users to tenant and role.
- `contacts` and `properties` are central entities linked to `appointments`, `messages`, and events.
- Public-site entities are tenant-owned and surfaced by RPCs only.
- Job/metric tables are tenant-scoped and designed for batch processing + dashboard snapshots.

### Data Storage Strategy
- **Primary DB:** Supabase Postgres (transactional + RLS + RPC).
- **Object storage:** Supabase Storage (`site-assets`) for logos/banners/media paths.
- **Retention:** operational logs/events retained in Postgres for traceability.
- **Backups:** managed by Supabase project backup policies.

---

## 5. API Specifications

### API Design Approach
- **Protocol:** REST route handlers + Postgres RPC calls.
- **Authentication:** Supabase session auth (dashboard) and token-based endpoints (public integrations).
- **Versioning:** path-stable internal API; schema evolution via migrations and additive fields.

### Endpoint Groups

#### Public Site Data
- `POST /rest/v1/rpc/site_get_settings`
- `POST /rest/v1/rpc/site_list_properties`
- `POST /rest/v1/rpc/site_get_property`
- `POST /rest/v1/rpc/site_create_lead`
- `POST /rest/v1/rpc/site_list_news`
- `POST /rest/v1/rpc/site_get_news`
- `POST /rest/v1/rpc/site_list_links`

**Auth:** anon/authenticated allowed by function grants; strict tenant resolution by slug/domain.

#### Lead Ingestion
- `POST /api/webhooks/leads/[token]`
  - Validates payload.
  - Calls `webhook_ingest_lead`.
  - Returns `200` with `contact_id` or explicit `4xx/5xx`.

#### Feed Export
- `GET /api/feeds/[portal]/[token]`
  - Emits XML for configured portal and tenant token.
  - Uses `feed_properties` and portal settings.

#### Automation Jobs
- `POST /api/jobs/followups/process`
  - Owner/manager scoped or cron-secret scoped.
  - Calls `followup_process_due`.

- `POST /api/jobs/leads/redistribute`
  - Owner/manager scoped or cron-secret scoped.
  - Calls `lead_redistribute_overdue`.

#### Goals
- `POST /api/settings/goals`
  - Saves global and/or broker override goal settings.
  - Enforces owner/manager permissions.

### API Security
- Middleware host-aware routing and auth session refresh.
- RLS by `organization_id` + role checks.
- SECURITY DEFINER RPCs with explicit grants and bounded parameters.
- Tokenized integration endpoints (`feed_token`, webhook token).

---

## 6. Non-Functional Requirements Mapping

| NFR ID | Requirement | Architectural Decision | Status |
|--------|-------------|------------------------|--------|
| NFR-001 | p95 list/filter responsiveness | Server-side data access, indexes, client debounce, scoped queries | Addressed |
| NFR-002 | Queue-friendly automation scaling | `followup_jobs`/redistribution batch processors with bounded `p_limit` + skip-locked | Addressed |
| NFR-003 | Tenant isolation and role security | RLS, `current_user_org_id()`, `current_user_role()`, security-definer RPC boundary | Addressed |
| NFR-004 | Operational observability | `contact_events`, integration runs/issues, explicit job statuses/errors | Addressed |
| NFR-005 | Reliable non-duplicated processing | Unique constraints, conflict-safe inserts, idempotent first-response metrics | Addressed |
| NFR-006 | Mobile-first public conversion | Dedicated public templates, CTA-first contact flows, clean-domain routing | Addressed |

---

## 7. Technology Stack

### Frontend
- **Framework:** Next.js 16 (App Router), React 19, TypeScript.
- **UI:** Tailwind CSS v4, Radix primitives, custom components.
- **Forms/validation:** React Hook Form + Zod.
- **Charts:** Recharts.

### Backend/Application
- **Server runtime:** Next.js route handlers (Node runtime).
- **Auth/session:** `@supabase/ssr` + middleware-based session updates.
- **Business orchestration:** API handlers + Postgres RPC.

### Data and Storage
- **Database:** Supabase Postgres.
- **Object storage:** Supabase Storage.
- **Auth provider:** Supabase Auth.

### Quality and delivery
- **Tests:** Jest + Playwright.
- **Lint/build gate:** GitHub Actions (`ci.yml`, `deploy.yml`).
- **Hosting:** Vercel.

---

## 8. Trade-off Analysis

1. **Modular monolith vs microservices**
- Chosen monolith reduces operations and accelerates delivery.
- Trade-off: less independent scaling per bounded context today.

2. **RPC-centric data access vs rich backend service layer**
- RPC centralizes tenant-safe logic and reduces API duplication.
- Trade-off: more logic in SQL/PLpgSQL; requires migration discipline.

3. **Tokenized integration endpoints**
- Fast onboarding with portal/webhook tokens.
- Trade-off: token lifecycle hygiene and monitoring become essential.

4. **Async batch job endpoints**
- Keeps UI fast and avoids heavy synchronous work.
- Trade-off: requires reliable scheduling and visibility of job health.

---

## 9. Deployment Architecture

### Current
- Vercel project deploys Next.js app from `main`.
- Environment variables provide Supabase URL/keys and job secrets.
- Domain strategy:
  - App host (`vivacrm.com.br` / `www`).
  - Tenant paths (`/s/[slug]`) and custom-domain rewrite support.

### Runtime flow
1. Request reaches Vercel edge/runtime.
2. Middleware resolves host context:
   - app host: standard app/dashboard routes.
   - tenant/custom host: rewrite to `/s/[slug]` internally.
3. Route handler or server component calls Supabase with session or anon key.
4. Database enforces tenant/RBAC and returns scoped data.

### Operational jobs
- Follow-up and SLA processors are invoked via API endpoints.
- Designed for cron invocation with bearer secret (or manager-triggered manual runs).

---

## 10. Future Considerations

1. **Scale path (>1k tenants)**
- Introduce queue worker layer for automation jobs (separate runtime), keep same RPC contracts.
- Add partitioning/archival strategy for high-volume `messages` and `contact_events`.

2. **Media cost/performance optimization**
- Keep Supabase storage paths as source of truth.
- Optionally front static public media with CDN proxy/cache strategy.

3. **WhatsApp add-on hardening**
- Keep add-on isolated by module and billing boundary.
- Maintain plan separation: CRM base vs CRM + official WhatsApp.

4. **Service extraction candidates**
- Integrations module and automation engine are first candidates if monolith pressure increases.

5. **Architecture governance**
- Keep migration-first change discipline.
- Maintain NFR regression checks in CI and release checklist.

