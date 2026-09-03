import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('portal_integrations')
    .select('organization_id, config, organizations(slug, name)')
    .eq('portal', 'imovelweb');

  if (error) { console.error(error); return; }

  console.log('\n=== URLs do Feed Imovelweb por organização ===\n');
  for (const row of data ?? []) {
    const org = (row as any).organizations;
    const token = (row as any).config?.feed_token;
    const slug = org?.slug;
    const name = org?.name;
    console.log(`${name} (${slug})`);
    console.log(`  https://www.vivacrm.com.br/api/public/s/${slug}/imovelweb-xml?token=${token}`);
    console.log();
  }
}

main();
