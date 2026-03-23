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
    console.log('--- Organizations ---');
    orgs?.forEach(org => {
        console.log(`ID: ${org.id} | Name: ${org.name} | Slug: ${org.slug}`);
    });

    const { data: integrations, error: intError } = await supabase
        .from('portal_integrations')
        .select('organization_id, portal, config, status');
    
    if (intError) {
        console.error('Error fetching integrations:', intError);
        return;
    }

    console.log('\n--- Portal Integrations ---');
    integrations?.forEach(int => {
        console.log(`Org ID: ${int.organization_id} | Portal: ${int.portal} | Status: ${int.status} | Config: ${JSON.stringify(int.config)}`);
    });
}

main();
