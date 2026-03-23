import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const { data: org } = await supabase.from('organizations').select('id, slug').eq('slug', 'bb9c5e0d-5d06-4d75-bfc7-16f49693a76b').single();

    if (!org) {
        console.error('Org not found by slug');
        return;
    }

    console.log(`Checking leads for Org ID: ${org.id} (Slug: ${org.slug})`);

    const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, phone, email, created_at')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });

    console.log('CONTACTS:', JSON.stringify(contacts, null, 2));

    const { data: messages } = await supabase
        .from('messages')
        .select('id, body, channel, created_at')
        .eq('organization_id', org.id)
        .order('created_at', { ascending: false });

    console.log('MESSAGES:', JSON.stringify(messages, null, 2));
}

main();
