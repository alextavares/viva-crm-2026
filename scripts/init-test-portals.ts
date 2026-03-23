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
        console.error('Org not found');
        return;
    }

    const portals = ['zap_vivareal', 'imovelweb'];

    for (const portal of portals) {
        const { error } = await supabase.from('portal_integrations').upsert({
            organization_id: org.id,
            portal: portal,
            status: 'active',
            config: {
                feed_token: 'test-token-123'
            }
        }, { onConflict: 'organization_id,portal' });

        if (error) console.error(`Error upserting ${portal}:`, error);
        else console.log(`Portal ${portal} initialized.`);
    }
}

main();
