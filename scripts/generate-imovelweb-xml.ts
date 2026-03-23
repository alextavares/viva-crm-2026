import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { generateImovelwebXml } from '../src/lib/integrations/imovelweb-mapper';
import { CRMProperty } from '../src/lib/integrations/zap-mapper';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const orgSlug = 'bb9c5e0d-5d06-4d75-bfc7-16f49693a76b';

    // Get organization
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('slug', orgSlug)
        .single();

    if (orgError || !org) {
        console.error('Org not found:', orgError);
        return;
    }
    console.log(`✅ Organization: ${org.name} (${org.id})`);

    // Check portal integration
    const { data: integration } = await supabase
        .from('portal_integrations')
        .select('config, status, last_sync_at')
        .eq('organization_id', org.id)
        .eq('portal', 'imovelweb')
        .single();

    console.log(`📋 Portal integration status: ${integration?.status ?? 'NOT FOUND'}`);
    console.log(`🔑 Feed token: ${(integration?.config as any)?.feed_token ?? 'N/A'}`);

    // Fetch eligible properties
    const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('organization_id', org.id)
        .eq('status', 'available')
        .eq('publish_to_portals', true)
        .eq('publish_imovelweb', true)
        .or('hide_from_site.is.null,hide_from_site.eq.false');

    if (propError) {
        console.error('Error fetching properties:', propError);
        return;
    }

    console.log(`🏠 Properties eligible for Imovelweb feed: ${properties?.length ?? 0}`);

    if (!properties || properties.length === 0) {
        console.warn('\n⚠️  No properties found. Make sure at least one property has:');
        console.warn('   - status = "available"');
        console.warn('   - publish_to_portals = true');
        console.warn('   - publish_imovelweb = true');
        console.warn('   - hide_from_site = false or null');
        return;
    }

    // Generate XML
    const xml = generateImovelwebXml(properties as CRMProperty[]);

    // Save to file
    const outputPath = path.resolve(process.cwd(), 'imovelweb-feed.xml');
    fs.writeFileSync(outputPath, xml, 'utf-8');

    console.log(`\n✅ XML gerado com sucesso!`);
    console.log(`📄 Arquivo: ${outputPath}`);
    console.log(`\n--- Prévia do XML ---`);
    console.log(xml.substring(0, 1500));
    if (xml.length > 1500) {
        console.log(`\n... (${xml.length} chars total — veja o arquivo completo)`);
    }
}

main();
