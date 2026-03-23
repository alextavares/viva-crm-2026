import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    const ids = ['95a267da-2828-4645-9cfd-1bb12c0617a0', 'f35f7956-6544-484c-ae9a-14d2a0868e33'];

    console.log('--- VERIFICANDO CONTATOS CRIADOS ---');
    const { data: contacts, error: cErr } = await supabase
        .from('contacts')
        .select('id, name, email, phone')
        .in('id', ids);

    if (cErr) console.error('Erro contatos:', cErr);
    else console.log(JSON.stringify(contacts, null, 2));

    console.log('\n--- VERIFICANDO MENSAGENS ---');
    const { data: messages, error: mErr } = await supabase
        .from('messages')
        .select('id, body, channel, contact_id')
        .in('contact_id', ids);

    if (mErr) console.error('Erro mensagens:', mErr);
    else console.log(JSON.stringify(messages, null, 2));
}

main();
