import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateZapXml, CRMProperty } from '@/lib/integrations/zap-mapper';

// We need to use the Service Role key here to fetch data securely from the backend,
// skipping RLS for this specific public feed generation (which has its own token auth).
export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const { slug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
        return new Response('Missing token parameter.', { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get Organization by Slug
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('slug', slug)
        .single();

    if (orgError || !org) {
        return new Response('Organization not found.', { status: 404 });
    }

    // 2. Validate Feed Token (Simulated: Checking portal_integrations table)
    // We check if this org has a portal integration active with this token.
    const { data: configRows, error: configError } = await supabase
        .from('portal_integrations')
        .select('config')
        .eq('organization_id', org.id)
        .eq('portal', 'zap_vivareal')
        .single();

    if (configError || !configRows || !configRows.config) {
        return new Response('Portal integration not configured.', { status: 403 });
    }

    // Expecting config to store the token in `feed_token` key:
    const config = configRows.config as Record<string, unknown>;
    if (config.feed_token !== token) {
        return new Response('Invalid token.', { status: 403 });
    }

    // 3. Fetch Active Properties (Ignoring RLS by using Service Key)
    // The feed only exports properties explicitly enabled for portal publication.
    const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .eq('organization_id', org.id)
        .eq('status', 'available')
        .eq('publish_to_portals', true)
        .eq('publish_zap', true)
        .or('hide_from_site.is.null,hide_from_site.eq.false');

    if (propertiesError) {
        console.error('Error fetching properties for XML feed:', propertiesError);
        return new Response('Internal error listing properties.', { status: 500 });
    }

    // 4. Update the sync timestamp asynchronously
    // Don't wait for this to finish to avoid blocking the response.
    supabase
        .from('portal_integrations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('organization_id', org.id)
        .eq('portal', 'zap_vivareal')
        .then(({ error }) => {
            if (error) console.error('Failed to update last_sync_at', error);
        });

    // 5. Build XML
    const xmlString = generateZapXml(properties as CRMProperty[]);

    return new Response(xmlString, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400', // Cache 1hr at edge
        },
    });
}
