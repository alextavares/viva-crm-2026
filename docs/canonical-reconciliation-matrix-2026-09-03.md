# Mission 001 — Canonical app↔DB dependency matrix (2026-09-03)

Base: `ba8325c` on `codex/sprint-4-carteira-operacional`. Canonical contract:
9 migrations `supabase/migrations/20260830*_canonical_*.sql` + `supabase/tests/database/001_canonical_catalog.sql`.

## Canonical inventory (version-controlled)

- public tables (35): organizations, profiles, team_invites, team_audit_events,
  contacts, properties, contact_interactions, contact_events, messages,
  appointments, notifications, message_templates, opportunities, proposals,
  contracts, lead_distribution_settings, contact_followups, followup_settings,
  goal_settings, goal_profile_overrides, ai_lead_sessions, ai_lead_messages,
  ai_lead_qualifications, ai_lead_settings, site_settings, site_pages,
  site_banners, site_news, site_links, custom_domains, portal_integrations,
  portal_integration_runs, portal_integration_issues, whatsapp_channel_settings,
  whatsapp_addon_settings.
- private tables (12, never referenced by app code): integration_credentials,
  idempotency_receipts, internal_jobs, invite_tokens, lead_distribution_state,
  property_public_code_counters, lead_response_metrics, whatsapp_usage_events,
  whatsapp_usage_monthly, seat_plans, seat_plan_changes, rate_limit_counters.
- api views: attendance_queue, contact_pipeline_summary.
- api RPCs (16): site_get_settings, site_list_properties, site_get_property,
  site_list_news, site_get_news, site_list_links, site_resolve_slug_by_domain,
  assign_contact, assign_opportunity, rotate_integration_credential,
  site_create_lead, imovelweb_feed, imovelweb_ingest, claim_internal_jobs,
  complete_internal_job, fail_internal_job.
- Privilege split: anon/authenticated → site_* reads; authenticated → assign_*,
  rotate_credential + direct public-table CRUD under RLS; service_role only →
  site_create_lead, imovelweb_feed/ingest, internal-jobs RPCs.

## Legacy table before → after (runtime `src`+`app`, exact `.from()` counts)

| Legacy table | Before | After | Disposition |
|---|---|---|---|
| ai_lead_reengagements | 8 | 0 | reconciled → settings to `ai_lead_settings`+`message_templates`; queue parked (gap P1) |
| ai_lead_reengagement_settings | 3 | 0 | reconciled → `ai_lead_settings` + `message_templates` |
| deal_contracts | 12 | 12 | GAP (opportunity-keyed `contracts`; contact-level linkage undecided) |
| deal_proposals | 8 | 8 | GAP (opportunity-keyed `proposals`) |
| broker_seat_plans / _changes | 7 / 12 | 7 / 12 | GAP (moved to private, no read path) |
| whatsapp_addon_pricing_settings | 9 | 9 | GAP (canonical `whatsapp_addon_settings`, column mapping undecided) |
| webhook_endpoints | 7 | 7 | GAP (no canonical table; secrets belong in private credentials) |
| followup_jobs | 5 | 5 | GAP (canonical `private.internal_jobs` + `contact_followups`; worker mapping undecided) |
| goal_broker_overrides | 5 | 5 | GAP (canonical `goal_profile_overrides`, profile-keyed) |
| leads / lead_interactions | 0 | 0 | already absent at runtime |
| feed_properties (table) | 0 | 0 | absent; RPC retired (below) |

## Legacy RPC before → after (runtime exact `.rpc()` counts)

| Legacy RPC | Before | After | Disposition |
|---|---|---|---|
| feed_properties | 1 | 0 | retired → `api.imovelweb_feed` |
| lead_assign_next_broker | 1 | 0 | reconciled → `lead_distribution_settings` + load-aware pick |
| portal_create_lead | 0 | 0 | absent (webhooks used hand-rolled logic; now canonical RPCs) |
| current_user_org_id | 1 | 1 | GAP (trivial: profiles lookup; untouched) |
| followup_schedule_sequence / followup_process_due / lead_redistribute_overdue | 1/1/1 | unchanged | GAP (no canonical worker RPC) |
| get_broker_seat_usage | 9 | 9 | GAP (private seats, no read path) |
| whatsapp_usage_snapshot / whatsapp_send_policy_check | 3 / 3→2 | 3 / 2 | GAP (private metering; addon kill-switch applied in AI engine) |
| goals_dashboard_snapshot | 2 | 2 | GAP (no canonical snapshot RPC; dashboard tolerates 42883/42P01) |
| webhook_ingest_lead | 2 | 2 | GAP (whatsapp/leads webhooks; no canonical ingest RPC) |

## Column-level reconciliation (runtime breaks vs canonical, all fixed)

- `contact_events.type` → `event_type` (~20 sites: dashboard, attendances,
  contacts, appointments/new, settings/site, analytics, whatsapp action/send
  route, AI engine).
- `appointments.date` → `starts_at` (dashboard, attendances, contact detail
  boundary adapters).
- `properties.hide_from_site`/`images` → `publish_to_site` (inverted) /
  `image_paths` (dashboard, properties page/lists, bulk actions).
- `contacts.deal_stage` → latest open `opportunities.stage` mapping
  (dashboard funnel, attendances, contacts list/detail).
- `whatsapp_channel_settings.access_token` removed (no canonical column;
  production live-send is a gap, sandbox path preserved).
- AI session/contact handoff fields → `assigned_to` + canonical statuses
  (`qualified` at request, `handed_off` at takeover).
- `ai_lead_qualifications` upserts scoped to `(organization_id, session_id)`.
- `portal_integrations` status: canonical `enabled` enforced on imovelweb
  paths; secrets never written to `config` (contract CHECK).

## ImovelWeb status

- Webhook `POST /api/public/webhooks/[slug]/imovelweb` → `api.imovelweb_ingest`
  (service_role): server-side secret verify, bounded validation, deterministic
  `p_event_id` (`deriveImovelwebEventId`), no PII logging.
- Feed `GET /api/public/s/[slug]/imovelweb-xml` → `api.imovelweb_feed`
  (service_role, max 5000): bounded projection → `toFeedProperty` adapter →
  OpenNavent XML; only non-secret display config read from portal row.
- Legacy `GET /api/feeds/[portal]/[token]` → 410 Gone (no canonical generic
  feed; zap/olx feeds are a gap).
- Zap webhook → canonical `api.site_create_lead` (`source_domain='zap'`) +
  `phone_normalized` dedupe + `messages.external_message_id`; token bridge
  kept (gap: no zap credential store).

## database.types status

Rewritten by hand from the 9 canonical migrations (35 public tables, api
views/RPCs incl. `claimed_job` composite). Private schema absent by design.
`npm run db:verify-types` passes; `npx tsc --noEmit` clean.

## CANONICAL CONTRACT GAPs (exact)

1. `CANONICAL CONTRACT GAP: zap/olx feed RPCs` — no canonical feed contract
   beyond imovelweb.
2. `CANONICAL CONTRACT GAP: zap webhook credential store` — no
   non-imovelweb webhook secret provisioning/verification RPC.
3. `CANONICAL CONTRACT GAP: reengagement execution queue` — no per-lead
   cadence table; settings persist, worker parks with empty pass.
4. `CANONICAL CONTRACT GAP: whatsapp production send credential read` —
   `private.integration_credentials` (whatsapp_access) has no read path.
5. `CANONICAL CONTRACT GAP: whatsapp usage metering` — private usage tables
   unreadable; addon enabled-flag enforced only.
6. `CANONICAL CONTRACT GAP: billing seats read path` — `private.seat_plans`
   unreadable; seat UI/RPCs untouched (9+19 refs).
7. `CANONICAL CONTRACT GAP: goals snapshot RPC` — dashboard degrades.
8. `CANONICAL CONTRACT GAP: followup/lead-distribution worker RPCs` —
   `followup_jobs` flows untouched.
9. `CANONICAL CONTRACT GAP: contact-level deals` — `proposals`/`contracts`
   are opportunity-keyed; contact panels untouched (graceful-degrade guards).
10. `CANONICAL CONTRACT GAP: public site_pages/banners RPC` — pages empty;
    banners via bounded service_role select; property detail resolves
    public_code→UUID server-side (predicate-equivalent).
11. `CANONICAL CONTRACT GAP: property structured attributes` —
    bedrooms/bathrooms have no canonical columns (`features` is text[]).

## P0/P1 remaining

- P0: none in the reconciled slice (typecheck/lint/tests/build green; routes
  bounded; no secrets; no PII logs).
- P1: gaps 1–11 above (each needs a contract/product decision; slices left
  byte-identical except documented adapters).
