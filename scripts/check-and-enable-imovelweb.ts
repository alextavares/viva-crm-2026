import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const orgSlug = 'bb9c5e0d-5d06-4d75-bfc7-16f49693a76b';
    const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).single();
    if (!org) { console.error('Org not found'); return; }

    // Check all available properties
    const { data: allAvailable } = await supabase
        .from('properties')
        .select('id, title, status, publish_to_portals, publish_imovelweb, hide_from_site, type, transaction_type, price')
        .eq('organization_id', org.id)
        .eq('status', 'available')
        .limit(10);

    console.log(`\n📊 Available properties (status=available): ${allAvailable?.length ?? 0}`);
    allAvailable?.forEach(p => {
        console.log(`  - [${p.id}] "${p.title}" | publish_to_portals=${p.publish_to_portals} | publish_imovelweb=${p.publish_imovelweb} | hide_from_site=${p.hide_from_site}`);
    });

    // Also check properties of any status
    const { data: anyProps } = await supabase
        .from('properties')
        .select('id, title, status, publish_to_portals, publish_imovelweb, hide_from_site, type, transaction_type, price')
        .eq('organization_id', org.id)
        .limit(5);

    console.log(`\n📋 All properties (any status, first 5): ${anyProps?.length ?? 0}`);
    anyProps?.forEach(p => {
        console.log(`  - [${p.id}] "${p.title}" | status=${p.status} | type=${p.type} | price=${p.price}`);
    });

    if (!allAvailable || allAvailable.length === 0) {
        console.log('\n⚠️  No available properties found. Cannot enable for Imovelweb test.');
        return;
    }

    // Enable the first available property for Imovelweb
    const target = allAvailable[0];
    console.log(`\n🔧 Enabling property "${target.title}" for Imovelweb...`);

    const { error } = await supabase
        .from('properties')
        .update({ publish_to_portals: true, publish_imovelweb: true, hide_from_site: false })
        .eq('id', target.id);

    if (error) {
        console.error('Error updating property:', error);
    } else {
        console.log(`✅ Property enabled for Imovelweb!`);
        console.log(`   Run the generate script again to get the XML.`);
    }
}

main();
