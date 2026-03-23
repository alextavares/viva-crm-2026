import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Carrega as variáveis de ambiente baseadas no .env.local
dotenv.config({ path: '.env.local' });

// Simulate the logic of imovelweb-mapper.ts locally
import { generateImovelwebXml } from './src/lib/integrations/imovelweb-mapper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao estao definidos.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- Iniciando teste do Gerador de Feed XML (Imovelweb) ---');

    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .limit(1)
        .single();

    if (orgError || !org) {
        console.error('Erro ao buscar organização:', orgError);
        return;
    }

    const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .eq('organization_id', org.id)
        .eq('status', 'available')
        .eq('hide_from_site', false);

    if (propertiesError) {
        console.error('Erro ao buscar imóveis:', propertiesError);
        return;
    }

    if (properties && properties.length > 0) {
        try {
            const xmlString = generateImovelwebXml(properties as import('./src/lib/integrations/zap-mapper').CRMProperty[]);

            const outputPath = path.join(process.cwd(), 'imovelweb-test-feed.xml');
            fs.writeFileSync(outputPath, xmlString);

            console.log(`✅ XML gerado com sucesso! Arquivo salvo em: ${outputPath}`);
            console.log('\n--- Preview (Primeiros 500 chars) ---');
            console.log(xmlString.substring(0, 500) + '...\n');
        } catch (e) {
            console.error('Erro ao gerar XML:', e);
        }
    } else {
        console.log('Nenhum imóvel disponível para testar.');
    }
}

run();
