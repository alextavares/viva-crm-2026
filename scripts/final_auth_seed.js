const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

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
        console.error('Example: node scripts/final_auth_seed.js --site-slug demo-vivacrm');
        process.exit(1);
    }
    return siteSlug.trim();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const requiredSiteSlug = requireSiteSlug();

    console.log('Signing in...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'e2e.imobicrm.2026@gmail.com',
        password: 'TempE2E!2026'
    });

    if (authError) {
        console.error('Auth Error:', authError.message);
        return;
    }
    console.log('Signed in successfully.');

    // Get Organization ID
    const { data: profile, error: profError } = await supabase.from('profiles').select('organization_id').single();
    if (profError) {
        console.error('Profile Error:', profError.message);
        return;
    }
    const orgId = profile.organization_id;
    console.log('Org ID:', orgId);

    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('slug')
        .eq('id', orgId)
        .single();

    if (orgError || !org) {
        console.error('Organization lookup error:', orgError?.message || orgError);
        return;
    }

    if (org.slug !== requiredSiteSlug) {
        console.error(`Refusing to seed. Current user org slug is "${org.slug}", expected "${requiredSiteSlug}".`);
        return;
    }

    // INSERT NEWS
    const news = [
        {
            organization_id: orgId,
            title: 'VivaCRM Lançamento 2026',
            slug: 'vivacrm-lancamento-2026',
            content: 'Este é o conteúdo da notícia de lançamento do VivaCRM 2026. Esperamos que todos aproveitem as novas funcionalidades. Este texto tem o tamanho necessário para o componente.',
            is_published: true,
            published_at: new Date().toISOString()
        },
        {
            organization_id: orgId,
            title: 'Notícia em Rascunho',
            slug: 'noticia-rascunho',
            content: 'Conteúdo em rascunho de teste para garantir que não apareça na listagem pública.',
            is_published: false
        }
    ];

    console.log('Inserting news...');
    const { error: insError } = await supabase.from('site_news').upsert(news, { onConflict: 'organization_id,slug' });
    if (insError) console.error('Insert News Error:', insError.message);
    else console.log('News inserted!');

    // INSERT LINKS
    const links = [
        {
            organization_id: orgId,
            title: 'Google',
            url: 'https://google.com',
            sort_order: 2,
            is_published: true
        },
        {
            organization_id: orgId,
            title: 'VivaCRM Help',
            url: 'https://ajuda.vivacrm.com.br',
            sort_order: 1,
            is_published: true
        }
    ];

    console.log('Inserting links...');
    for (const link of links) {
        const { error: lError } = await supabase.from('site_links').upsert(link, { onConflict: 'organization_id,url' });
        if (lError) {
            // If individual upsert fails, try insert
            await supabase.from('site_links').insert(link);
        }
    }
    console.log('Links handled.');

    console.log('DONE');
}

run();
