import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const { data: orgs, error } = await supabase.from('organizations').select('id, name, slug');
    if (error) {
        console.error('Error fetching orgs:', error);
        return;
    }
    
    for (const org of (orgs || [])) {
        console.log(`ORG: ${org.name} | SLUG: ${org.slug}`);
        
        const { data: integrations } = await supabase
            .from('portal_integrations')
            .select('portal, config, status')
            .eq('organization_id', org.id);
            
        integrations?.forEach(int => {
            if (int.portal === 'imovelweb') {
                console.log(`  - PORTAL: ${int.portal} | STATUS: ${int.status} | TOKEN: ${(int.config as any)?.feed_token}`);
            }
        });
    }
}

main();
