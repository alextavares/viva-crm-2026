import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Seeding fake property data for testing Zap XML feed...');

    const { data: org } = await supabase.from('organizations').select('id, name').limit(1).single();

    if (!org) {
        console.error('No org found');
        return;
    }

    // Check if we have any properties, if not insert one
    const { data: existingProps } = await supabase.from('properties').select('id').eq('organization_id', org.id);

    if (!existingProps || existingProps.length === 0) {
        console.log('Inserting mock property...');
        await supabase.from('properties').insert({
            organization_id: org.id,
            public_code: 'ZAP-001',
            title: 'Casa Espetacular Vista Mar',
            description: 'Linda casa com 3 suites e piscina com borda infinita. Ótima oportunidade de investimento.',
            price: 1500000,
            type: 'house',
            status: 'available',
            hide_from_site: false,
            features: { bedrooms: 3, suites: 3, bathrooms: 4, garage: 2, area: 350 },
            address: { street: 'Av Beira Mar', neighborhood: 'Praia Mansa', city: 'Florianópolis', state: 'SC', zip: '88000-000' },
            images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
        });
    } else {
        // Just update the first one to be available and public
        console.log('Updating existing property to be public...');
        await supabase.from('properties').update({
            status: 'available',
            hide_from_site: false,
            features: { bedrooms: 3, suites: 3, bathrooms: 4, garage: 2, area: 350 },
            address: { street: 'Av Beira Mar', neighborhood: 'Praia Mansa', city: 'Florianópolis', state: 'SC', zip: '88000-000' },
            images: ['https://example.com/image1.jpg']
        }).eq('id', existingProps[0].id);
    }

    console.log('Done mapping property for ZAP feed testing.');
}

run();
