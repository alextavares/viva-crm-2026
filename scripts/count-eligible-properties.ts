import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const slug = 'demo-vivacrm';
    const { data: org } = await supabase.from('organizations').select('id').eq('slug', slug).single();
    if (!org) { console.error('Org not found'); return; }

    const { data: properties, error } = await supabase
        .from('properties')
        .select('id, title, status, publish_to_portals, publish_imovelweb, hide_from_site')
        .eq('organization_id', org.id)
        .eq('status', 'available')
        .eq('publish_to_portals', true)
        .eq('publish_imovelweb', true);

    if (error) {
        console.error('Error fetching properties:', error);
        return;
    }

    console.log(`Eligible properties for Imovelweb (slug=${slug}): ${properties?.length ?? 0}`);
    properties?.forEach(p => {
        console.log(`  - ${p.title} (ID: ${p.id})`);
    });
}

main();
