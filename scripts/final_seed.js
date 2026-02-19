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
    console.error('Example: node scripts/final_seed.js --site-slug demo-vivacrm');
    process.exit(1);
  }
  return siteSlug.trim();
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || (!serviceKey && !anonKey)) {
  console.error('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and key (service role preferred).');
  process.exit(1);
}

async function createAuthorizedClient() {
  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey);
  }

  const email = getArg('email');
  const password = getArg('password');
  if (!email || !password) {
    console.error('Without SUPABASE_SERVICE_ROLE_KEY, provide --email and --password.');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.error(`Auth Error: ${error.message}`);
    process.exit(1);
  }
  return client;
}

async function run() {
    const supabase = await createAuthorizedClient();
    const siteSlug = requireSiteSlug();
    console.log(`Seeding data for site slug: ${siteSlug}`);

    // Find Org ID
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', siteSlug)
        .single();

    if (orgError) {
        console.error('Error fetching org:', orgError.message);
        return;
    }

    const orgId = org.id;
    console.log('Org ID:', orgId);

    // Insert News
    const news = [
        {
            organization_id: orgId,
            title: 'VivaCRM Lançamento 2026',
            slug: 'vivacrm-lancamento-2026',
            excerpt: 'Lançamento oficial.',
            content: 'Este é o conteúdo da notícia de lançamento do VivaCRM 2026. Esperamos que todos aproveitem as novas funcionalidades. Conteúdo com mais de 50 caracteres para garantir validação.',
            is_published: true,
            published_at: new Date().toISOString()
        },
        {
            organization_id: orgId,
            title: 'Notícia em Rascunho',
            slug: 'noticia-rascunho',
            excerpt: 'Rascunho.',
            content: 'Conteúdo em rascunho.',
            is_published: false
        }
    ];

    console.log('Inserting news...');
    const { error: newsError } = await supabase.from('site_news').upsert(news, { onConflict: 'organization_id,slug' });
    if (newsError) console.error('News Error:', newsError.message);
    else console.log('News seeded successfully.');

    // Insert Links
    const links = [
        {
            organization_id: orgId,
            title: 'Google',
            url: 'https://google.com',
            description: 'Search engine',
            sort_order: 2,
            is_published: true
        },
        {
            organization_id: orgId,
            title: 'VivaCRM Help',
            url: 'https://ajuda.vivacrm.com.br',
            description: 'Support center',
            sort_order: 1,
            is_published: true
        }
    ];

    console.log('Inserting links...');
    const { error: linksError } = await supabase.from('site_links').upsert(links, { onConflict: 'organization_id,url' });
    if (linksError) {
        console.log('Upsert failed, trying individual inserts...');
        for (const link of links) {
            await supabase.from('site_links').insert(link);
        }
    } else {
        console.log('Links seeded successfully.');
    }

    console.log('DONE');
}

run();
