import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateImovelwebXml } from '@/lib/integrations/imovelweb-mapper';
import { CRMProperty } from '@/lib/integrations/zap-mapper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    const { slug } = await params;
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
        return new Response('Missing token parameter.', { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get Organization
    const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('slug', slug)
        .single();

    if (orgError || !org) {
        return new Response('Organization not found.', { status: 404 });
    }

    // 2. Validate Token
    const { data: configRows, error: configError } = await supabase
        .from('portal_integrations')
        .select('config')
        .eq('organization_id', org.id)
        .eq('portal', 'imovelweb')
        .single();

    if (configError || !configRows || !configRows.config) {
        return new Response('Portal integration not configured.', { status: 403 });
    }

    const config = configRows.config as Record<string, unknown>;
    if (config.feed_token !== token) {
        return new Response('Invalid token.', { status: 403 });
    }

    // 3. Fetch Properties
    // The feed only exports properties explicitly enabled for portal publication.
    const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .eq('organization_id', org.id)
        .eq('status', 'available')
        .eq('publish_to_portals', true)
        .eq('publish_imovelweb', true)
        .or('hide_from_site.is.null,hide_from_site.eq.false');

    if (propertiesError) {
        console.error('Error fetching properties:', propertiesError);
        return new Response('Internal error.', { status: 500 });
    }

    // 4. Update Sync Timestamp (Background)
    supabase
        .from('portal_integrations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('organization_id', org.id)
        .eq('portal', 'imovelweb')
        .then(({ error }) => {
            if (error) console.error('Failed to update last_sync_at', error);
        });

    // 5. Build XML
    const publisher = {
        name: org.name,
        email: `contato@${org.slug}.com.br` // Default generic email if none available
    };
    const xmlString = generateImovelwebXml(properties as CRMProperty[], publisher);

    return new Response(xmlString, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400',
        },
    });
}
