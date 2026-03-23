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

    if (!org) {
        console.error('Org de teste não encontrada.');
        return;
    }

    // Criar um único imóvel de teste clássico
    const mockProperty = {
        organization_id: org.id,
        title: "Imóvel de Teste - Sandbox Imovelweb",
        description: "Este é um imóvel de teste para validar a integração de feed XML.",
        type: "house",
        status: "available",
        price: 950000,
        features: {
            bedrooms: 2,
            bathrooms: 2,
            area: 120,
            garage: 1
        },
        address: {
            city: "São Paulo",
            neighborhood: "Pinheiros",
            street: "Rua dos Pinheiros, 100",
            state: "SP",
            zip: "05422-000"
        },
        images: ["https://picsum.photos/800/600"],
        public_code: "TESTE-IW-001",
        hide_from_site: false
    };

    // Limpar imóvel de teste anterior se existir
    await supabase
        .from('properties')
        .delete()
        .eq('organization_id', org.id)
        .eq('public_code', 'TESTE-IW-001');

    const { data, error } = await supabase
        .from('properties')
        .insert(mockProperty)
        .select()
        .single();

    if (error) {
        console.error('Erro ao criar imóvel de teste:', error);
    } else {
        console.log('✅ Imóvel de teste criado com sucesso!');
        console.log('Public Code:', data.public_code);
        console.log('Agora você pode abrir o link do XML no navegador e verá apenas este imóvel.');
    }
}

main();
