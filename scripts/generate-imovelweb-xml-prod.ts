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
    const orgSlug = 'demo-vivacrm'; // Production slug

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

    // Fetch eligible properties
    const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('organization_id', org.id)
        .eq('status', 'available')
        .eq('publish_to_portals', true)
        .eq('publish_imovelweb', true);

    if (propError) {
        console.error('Error fetching properties:', propError);
        return;
    }

    console.log(`🏠 Properties found for Imovelweb: ${properties?.length ?? 0}`);

    if (!properties || properties.length === 0) {
        console.warn('\n⚠️  No properties found.');
        return;
    }

    // Generate XML
    const publisher = { name: 'Imobiliária Teste', email: 'contato@teste.com' };
    const xml = generateImovelwebXml(properties as CRMProperty[], publisher);

    // Save to file
    const outputPath = path.resolve(process.cwd(), 'imovelweb-prod-test.xml');
    fs.writeFileSync(outputPath, xml, 'utf-8');

    console.log(`\n✅ XML de PRODUÇÃO gerado com sucesso!`);
    console.log(`📄 Arquivo: ${outputPath}`);
    console.log(`\n--- Primeiros 2000 caracteres do XML ---`);
    console.log(xml.substring(0, 2000));
}

main();
