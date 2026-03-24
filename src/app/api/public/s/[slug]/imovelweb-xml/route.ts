import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateImovelwebXml } from '@/lib/integrations/imovelweb-mapper';
import { CRMProperty } from '@/lib/integrations/zap-mapper';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('[imovelweb-xml] Missing env vars:', {
                hasUrl: !!supabaseUrl,
                hasKey: !!supabaseServiceKey,
            });
            return new Response('Server misconfiguration: missing environment variables.', { status: 500 });
        }

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
            console.error('[imovelweb-xml] Org lookup error:', orgError?.message, 'slug:', slug);
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
            console.error('[imovelweb-xml] Config lookup error:', configError?.message, 'org:', org.id);
            return new Response('Portal integration not configured.', { status: 403 });
        }

        const config = configRows.config as Record<string, unknown>;
        if (config.feed_token !== token) {
            return new Response('Invalid token.', { status: 403 });
        }

        // 3. Fetch Properties
        const { data: properties, error: propertiesError } = await supabase
            .from('properties')
            .select('*')
            .eq('organization_id', org.id)
            .eq('status', 'available')
            .eq('publish_to_portals', true)
            .eq('publish_imovelweb', true)
            .or('hide_from_site.is.null,hide_from_site.eq.false');

        if (propertiesError) {
            console.error('[imovelweb-xml] Properties fetch error:', propertiesError.message);
            return new Response('Internal error fetching properties.', { status: 500 });
        }

        // 4. Update Sync Timestamp (Background - fire and forget)
        supabase
            .from('portal_integrations')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('organization_id', org.id)
            .eq('portal', 'imovelweb')
            .then(({ error }) => {
                if (error) console.error('[imovelweb-xml] Failed to update last_sync_at:', error.message);
            });

        // 5. Build XML
        const publisher = {
            name: org.name || 'Anunciante',
            email: `contato@${org.slug}.com.br`,
        };
        const xmlString = generateImovelwebXml(properties as CRMProperty[], publisher);

        return new Response(xmlString, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[imovelweb-xml] Unhandled exception:', msg);
        return new Response(`Internal server error: ${msg}`, { status: 500 });
    }
}
