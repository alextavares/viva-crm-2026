import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase/migrations');
const migrations = readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
const expected = [
  'canonical_01_foundation', 'canonical_02_identity_team', 'canonical_03_crm_inventory',
  'canonical_04_pipeline_followup_goals', 'canonical_05_ai_site', 'canonical_06_integrations_billing_private',
  'canonical_07_api_contracts', 'canonical_08_rls_grants', 'canonical_09_storage',
];
if (migrations.length !== expected.length || migrations.some((file, index) => !file.endsWith(`_${expected[index]}.sql`))) {
  throw new Error(`active migration sequence mismatch: ${migrations.join(', ')}`);
}
if (migrations.some((file) => statSync(join(migrationsDir, file)).size === 0)) throw new Error('empty active migration');

const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
for (const required of ['"public", "api", "graphql_public"', 'sql_paths = ["./seed.sql"]', 'minimum_password_length = 12']) {
  if (!config.includes(required)) throw new Error(`config missing ${required}`);
}
if (config.includes('private"')) throw new Error('private schema must not be exposed in config');

const canonical = migrations.map((file) => readFileSync(join(migrationsDir, file), 'utf8')).join('\n');
for (const forbidden of ['portal_create_lead', 'feed_properties', 'broker_id', 'assignee_id', 'deal_proposals', 'deal_contracts', 'webhook_endpoints']) {
  if (canonical.includes(forbidden)) throw new Error(`legacy object appears in canonical migrations: ${forbidden}`);
}
for (const required of ['private.integration_credentials', 'private.idempotency_receipts', 'private.internal_jobs', 'api.imovelweb_feed', 'api.imovelweb_ingest', 'storage.objects']) {
  if (!canonical.includes(required)) throw new Error(`canonical contract missing ${required}`);
}

const manifest = readFileSync(join(root, 'supabase/legacy/2026-08-30-precanonical/SHA256SUMS.before'), 'utf8').trim().split('\n');
if (manifest.length !== 75) throw new Error(`expected 75 legacy manifest entries, got ${manifest.length}`);
for (const line of manifest) {
  const [hash, ...parts] = line.trim().split(/\s+/);
  const original = parts.join(' ');
  const relative = original === 'supabase/types.ts'
    ? 'database.types.ts'
    : original.replace(/^supabase\/(migrations\/)?/, (match) => match.includes('migrations') ? 'migrations/' : '');
  const file = join(root, 'supabase/legacy/2026-08-30-precanonical', relative);
  const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (actual !== hash) throw new Error(`legacy hash mismatch: ${basename(file)}`);
}
console.log(`canonical baseline verified: ${migrations.length} migrations; ${manifest.length} legacy hashes preserved`);
