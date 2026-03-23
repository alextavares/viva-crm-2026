import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const orgId = 'bb9c5e0d-5d06-4d75-bfc7-16f49693a76b';

    console.log('--- RECENT CONTACTS ---');
    const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, phone, email, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5);
    console.log(JSON.stringify(contacts, null, 2));

    console.log('\n--- RECENT MESSAGES ---');
    const { data: messages } = await supabase
        .from('messages')
        .select('id, body, channel, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(5);
    console.log(JSON.stringify(messages, null, 2));
}

main();
