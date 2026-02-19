
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

function getArg(name) {
    const flag = `--${name}`;
    const prefix = `${flag}=`;
    const exact = process.argv.find((arg) => arg.startsWith(prefix));
    if (exact) return exact.slice(prefix.length);

    const index = process.argv.indexOf(flag);
    if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
    return null;
}

function requireSiteSlug() {
    const siteSlug = getArg('site-slug');
    if (!siteSlug) {
        console.error('Missing required argument: --site-slug <slug>');
        console.error('Example: node scripts/seed_db.js --site-slug demo-vivacrm');
        process.exit(1);
    }
    return siteSlug.trim();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    const requiredSiteSlug = requireSiteSlug();
    const email = 'e2e.imobicrm.2026@gmail.com';
    const password = 'TempE2E!2026';

    console.log('Signing in...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (authError) {
        console.error('Auth Error:', authError);
        return;
    }

    const userId = authData.user.id;
    console.log('User ID:', userId);

    // Get Organization ID
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

    if (profileError) {
        console.error('Profile/Org Error:', profileError);
        return;
    }

    const orgId = profile.organization_id;
    console.log('Organization ID:', orgId);

    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('slug')
        .eq('id', orgId)
        .single();

    if (orgError || !org) {
        console.error('Organization lookup error:', orgError);
        return;
    }

    if (org.slug !== requiredSiteSlug) {
        console.error(`Refusing to seed. Current user org slug is "${org.slug}", expected "${requiredSiteSlug}".`);
        return;
    }

    // --- SEED NEWS ---
    console.log('Seeding News...');
    const newsItems = [
        {
            organization_id: orgId,
            title: 'VivaCRM Lançamento 2026',
            slug: 'vivacrm-lancamento-2026',
            excerpt: 'Notícia de lançamento oficial.',
            content: 'Este é o conteúdo da notícia de lançamento do VivaCRM 2026. Esperamos que todos aproveitem as novas funcionalidades. Texto longo para passar na validação de 50 caracteres.',
            is_published: true,
            published_at: new Date().toISOString()
        },
        {
            organization_id: orgId,
            title: 'Notícia em Rascunho',
            slug: 'noticia-rascunho',
            excerpt: 'Apenas um rascunho.',
            content: 'Conteúdo em rascunho de teste.',
            is_published: false
        }
    ];

    const { error: newsError } = await supabase
        .from('site_news')
        .upsert(newsItems, { onConflict: 'organization_id,slug' });

    if (newsError) console.error('News Insert Error:', newsError);
    else console.log('News seeded successfully.');

    // --- SEED LINKS ---
    console.log('Seeding Links...');
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

    // Note: upsert for links might be tricky without a unique constraint besides ID, 
    // but we can just use delete-then-insert or just insert if it's a clean state.
    const { error: linksError } = await supabase
        .from('site_links')
        .upsert(links, { onConflict: 'organization_id,url' }); // Assuming organization_id, url might be unique for our test

    if (linksError) {
        console.log('Links Upsert might have failed if no unique constraint. Trying individual inserts...');
        for (const link of links) {
            await supabase.from('site_links').insert(link);
        }
    } else {
        console.log('Links seeded successfully.');
    }

    console.log('DONE: Seeding complete.');
}

seed();
