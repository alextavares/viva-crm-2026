const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

function getArg(name) {
    const flag = `--${name}`;
    const prefix = `${flag}=`;
    const exact = process.argv.find((arg) => arg.startsWith(prefix));
    if (exact) return exact.slice(prefix.length);

    const idx = process.argv.indexOf(flag);
    if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
    return null;
}

function requireSiteSlug() {
    const siteSlug = getArg('site-slug');
    if (!siteSlug) {
        console.error('Missing required argument: --site-slug <slug>');
        console.error('Example: node scripts/seed_test_data.js --site-slug demo-vivacrm');
        process.exit(1);
    }
    return siteSlug.trim();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
    console.error('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and key (service role preferred).');
    process.exit(1);
}

async function createAuthorizedClient() {
    if (supabaseServiceKey) {
        return createClient(supabaseUrl, supabaseServiceKey);
    }

    const email = getArg('email');
    const password = getArg('password');
    if (!email || !password) {
        console.error('Without SUPABASE_SERVICE_ROLE_KEY, provide --email and --password.');
        process.exit(1);
    }

    const client = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
        console.error('Auth Error:', error.message);
        process.exit(1);
    }

    return client;
}

async function run() {
    const siteSlug = requireSiteSlug();
    const supabase = await createAuthorizedClient();

    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', siteSlug)
        .single();

    if (orgError) {
        console.error('Error fetching org:', orgError);
        return;
    }

    console.log('Org ID:', org.id);

    // Insert News
    const news = [
        {
            organization_id: org.id,
            title: 'VivaCRM Lançamento 2026',
            slug: 'vivacrm-lancamento-2026',
            content: 'Este é o conteúdo da notícia de lançamento do VivaCRM 2026. Esperamos que todos aproveitem as novas funcionalidades.',
            is_published: true,
            published_at: new Date().toISOString()
        },
        {
            organization_id: org.id,
            title: 'Notícia em Rascunho',
            slug: 'noticia-rascunho',
            content: 'Conteúdo em rascunho.',
            is_published: false
        }
    ];

    const { error: newsError } = await supabase.from('site_news').upsert(news, { onConflict: 'organization_id,slug' });
    if (newsError) console.error('Error inserting news:', newsError);
    else console.log('News inserted successfully');

    // Insert Links
    const links = [
        {
            organization_id: org.id,
            title: 'Google',
            url: 'https://google.com',
            sort_order: 2,
            is_published: true
        },
        {
            organization_id: org.id,
            title: 'VivaCRM Help',
            url: 'https://ajuda.vivacrm.com.br',
            sort_order: 1,
            is_published: true
        }
    ];

    const { error: linksError } = await supabase.from('site_links').upsert(links);
    if (linksError) console.error('Error inserting links:', linksError);
    else console.log('Links inserted successfully');
}

run();
