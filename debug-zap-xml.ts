import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Carrega as variáveis de ambiente baseadas no .env.local
dotenv.config({ path: '.env.local' });

// Simulate the logic of zap-mapper.ts locally so we can run this via ts-node
import { generateZapXml, CRMProperty } from './src/lib/integrations/zap-mapper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("ERRO: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY nao estao definidos em .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- Iniciando teste do Gerador de Feed XML (ZAP) ---');

    // Pega a primeira organização para o teste
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .limit(1)
        .single();

    if (orgError || !org) {
        console.error('Erro ao buscar organização:', orgError);
        return;
    }

    console.log(`Organização alvo: ${org.name} (${org.id})`);

    // Busca os imóveis
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

    console.log(`Encontrados ${properties?.length || 0} imóveis disponíveis e públicos.`);

    if (properties && properties.length > 0) {
        try {
            // Gera o XML
            const xmlString = generateZapXml(properties as CRMProperty[]);

            const outputPath = path.join(process.cwd(), 'zap-test-feed.xml');
            fs.writeFileSync(outputPath, xmlString);

            console.log(`✅ XML gerado com sucesso! Arquivo salvo em: ${outputPath}`);
            console.log('\n--- Preview (Primeiros 500 chars) ---');
            console.log(xmlString.substring(0, 500) + '...\n');
        } catch (e) {
            console.error('Erro ao gerar XML:', e);
        }
    } else {
        console.log('Nenhum imóvel para testar. Tente criar um imóvel publico primeiro.');
    }

    console.log('--- Fim do teste ---');
}

run();
