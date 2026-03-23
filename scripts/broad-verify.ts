import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const orgId = '47190e69-3c1b-4a48-9131-6a608d9b0c34';

    console.log(`--- TODOS OS CONTATOS DA ORG: ${orgId} ---`);
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, name, email, phone, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

    if (error) console.error('Erro:', error);
    else console.log(JSON.stringify(contacts, null, 2));

    console.log('\n--- MENSAGENS RECENTES ---');
    const { data: messages } = await supabase
        .from('messages')
        .select('id, body, channel, contact_id, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

    console.log(JSON.stringify(messages, null, 2));
}

main();
