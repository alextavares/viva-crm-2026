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

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function requireSiteSlug() {
  const siteSlug = getArg('site-slug');
  if (!siteSlug) {
    console.error('Missing required argument: --site-slug <slug>');
    console.error('Example: node scripts/cleanup_site_content.js --site-slug demo-vivacrm --dry-run');
    process.exit(1);
  }
  return siteSlug.trim();
}

async function createAuthorizedClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || (!serviceKey && !anonKey)) {
    throw new Error('Missing Supabase env vars. Configure NEXT_PUBLIC_SUPABASE_URL and key.');
  }

  if (serviceKey) {
    return createClient(supabaseUrl, serviceKey);
  }

  const email = getArg('email');
  const password = getArg('password');
  if (!email || !password) {
    throw new Error('Without service role key, provide --email and --password for an owner/manager user.');
  }

  const client = createClient(supabaseUrl, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Auth failed: ${error.message}`);
  }

  return client;
}

async function run() {
  const siteSlug = requireSiteSlug();
  const dryRun = hasFlag('dry-run');
  const supabase = await createAuthorizedClient();

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id,slug')
    .eq('slug', siteSlug)
    .single();

  if (orgError || !org) {
    throw new Error(`Organization not found for slug "${siteSlug}"`);
  }

  const [{ count: newsCount, error: newsCountError }, { count: linksCount, error: linksCountError }] =
    await Promise.all([
      supabase.from('site_news').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
      supabase.from('site_links').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
    ]);

  if (newsCountError) throw newsCountError;
  if (linksCountError) throw linksCountError;

  console.log(`[${siteSlug}] news=${newsCount || 0} links=${linksCount || 0}`);

  if (dryRun) {
    console.log('Dry-run only. No data changed.');
    return;
  }

  const { error: deleteNewsError } = await supabase.from('site_news').delete().eq('organization_id', org.id);
  if (deleteNewsError) throw deleteNewsError;

  const { error: deleteLinksError } = await supabase.from('site_links').delete().eq('organization_id', org.id);
  if (deleteLinksError) throw deleteLinksError;

  console.log(`Cleanup completed for slug "${siteSlug}".`);
}

run().catch((error) => {
  console.error('Cleanup failed:', error.message || error);
  process.exit(1);
});
