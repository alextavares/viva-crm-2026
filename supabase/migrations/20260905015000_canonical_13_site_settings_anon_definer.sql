-- Canonical 13: bounded anon read of public site settings via api.site_get_settings ONLY.
-- Contract (canonical_07, inspected 2026-09-05): single-row slug-scoped projection
-- (to_jsonb(site_settings) minus organization_id, active orgs only, limit 1).
-- site_settings columns expose no keys/tokens/credentials/secrets/billing/internal IDs
-- (theme, brand_name, headline, description, colors, logo_path, public_* contact fields,
-- analytics_id / verification_id public embed ids, onboarding_complete, timestamps).
-- Mechanism: SECURITY DEFINER (fixed body, search_path='', stable) so the pre-existing
-- anon EXECUTE grant (canonical_08) works with NO direct anon SELECT on any table.
-- Scope: this function alone. No other api RPC, no table grants, no RLS/policy change.
alter function api.site_get_settings(text) security definer;
grant execute on function api.site_get_settings(text) to anon, authenticated;
