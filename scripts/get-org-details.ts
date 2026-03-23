import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const orgId = '47a9c756-0ae1-4993-928b-fe871a2133a5';
    const { data: org, error } = await supabase.from('organizations').select('id, name, slug').eq('id', orgId).single();
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log(`ORG: ${org.name} | SLUG: ${org.slug}`);
    
    const { data: integration } = await supabase
        .from('portal_integrations')
        .select('config, status')
        .eq('organization_id', org.id)
        .eq('portal', 'imovelweb')
        .single();
        
    console.log(`FEED TOKEN: ${(integration?.config as any)?.feed_token}`);
    console.log(`STATUS: ${integration?.status}`);
}

main();
