import { readFileSync, existsSync } from 'node:fs';

const path = 'src/lib/supabase/database.types.ts';
if (!existsSync(path)) throw new Error(`missing generated types: ${path}`);
const source = readFileSync(path, 'utf8');
if (!source.includes('export type Json')) throw new Error('types artifact is not Supabase TypeScript output');
if (source.includes('private')) throw new Error('private schema must not be present in public types');
for (const table of ['contacts', 'opportunities', 'proposals', 'contracts']) {
  if (!new RegExp(`\\b${table}:\\s*\\{`).test(source)) throw new Error(`missing canonical table type: ${table}`);
}
for (const forbidden of ['deal_proposals', 'deal_contracts', 'leads', 'feed_properties', 'broker_id', 'assignee_id']) {
  if (source.includes(forbidden)) throw new Error(`legacy name remains in generated types: ${forbidden}`);
}
console.log(`canonical types verified: ${path}`);
