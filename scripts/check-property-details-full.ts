import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const ids = ['e6c1cb50-6664-4d75-b099-6a996818cf82', 'f496e2f0-4f44-4c6d-a26c-52dab360f24d'];
    const { data: properties, error } = await supabase
        .from('properties')
        .select('*')
        .in('id', ids);

    if (error) {
        console.error('Error:', error);
        return;
    }

    properties?.forEach(p => {
        console.log(`\nProperty: ${p.title} (${p.id})`);
        console.log(`- type: ${p.type}`);
        console.log(`- transaction_type: ${p.transaction_type}`);
        console.log(`- price: ${p.price}`);
        console.log(`- condo_fee: ${p.condo_fee}`);
        console.log(`- iptu: ${p.iptu}`);
        console.log(`- total_area: ${p.total_area}`);
        console.log(`- build_area: ${p.build_area}`);
        console.log(`- All Features: ${JSON.stringify(p.features, null, 2)}`);
    });
}

main();
