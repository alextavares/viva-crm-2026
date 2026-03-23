import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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
    
    let report = '--- ALL ORGS ---\n';
    orgs?.forEach(org => {
        report += `- ${org.name} | SLUG: ${org.slug} | ID: ${org.id}\n`;
    });
    
    fs.writeFileSync('orgs_report.txt', report);
    console.log('Report saved to orgs_report.txt');
}

main();
