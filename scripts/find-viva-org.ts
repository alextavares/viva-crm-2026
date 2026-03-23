import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const { data: orgs, error } = await supabase.from('organizations').select('id, name, slug').ilike('name', '%viva%');
    if (error) {
        console.error('Error fetching orgs:', error);
        return;
    }
    
    console.log('--- VIVA ORGS ---');
    orgs?.forEach(org => {
        console.log(`- ${org.name} | SLUG: ${org.slug} | ID: ${org.id}`);
    });
}

main();
