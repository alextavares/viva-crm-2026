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
        .select('id, title, features')
        .in('id', ids);

    if (error) {
        console.error('Error:', error);
        return;
    }

    properties?.forEach(p => {
        console.log(`Property: ${p.title}`);
        console.log(`Features: ${JSON.stringify(p.features, null, 2)}`);
    });
}

main();
