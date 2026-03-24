import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Endpoint de Webhook para receber leads do Imovelweb.
 * URL esperada: POST /api/public/webhooks/[slug]/imovelweb?token=xyz
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    try {
        const { slug } = await params;
        const url = new URL(request.url);
        const token = url.searchParams.get('token');

        if (!token) {
            return NextResponse.json({ error: 'Token missing' }, { status: 401 });
        }

        // 1. Validar a Organização e o Token do Imovelweb
        const { data: orgData, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', slug)
            .single();

        if (orgError || !orgData) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const orgId = orgData.id;

        // 2. Buscar a configuração do portal para esta org
        const { data: configRows, error: configError } = await supabaseAdmin
            .from('portal_integrations')
            .select('config')
            .eq('organization_id', orgId)
            .eq('portal', 'imovelweb')
            .eq('status', 'active')
            .single();

        if (configError || !configRows) {
            return NextResponse.json({ error: 'Portal integration not active' }, { status: 403 });
        }

        const config = configRows.config as Record<string, unknown>;
        if (config.feed_token !== token) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
        }

        // 3. Fazer o parse do payload recebido do portal
        let payload: Record<string, unknown>;
        try {
            payload = await request.json() as Record<string, unknown>;
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
        }

        console.log(`[Webhook Imovelweb] Lead received for org ${slug}:`, JSON.stringify(payload));

        // 4. Extração Resiliente de Dados
        const castStr = (v: unknown) => (v ? String(v) : '');
        const name = castStr(payload.name || payload.nome || payload.firstName) || 'Lead Imovelweb';
        const phone = castStr(payload.phone || payload.telefone || payload.celular || payload.whatsapp);
        const email = castStr(payload.email || payload.mail);
        const rawMessage = castStr(payload.message || payload.mensagem || payload.observacao);
        const listingIdRaw = payload.listingId || payload.id_imovel || payload.codigo_imovel || payload.imovel;

        if (!phone) {
            return NextResponse.json({ error: 'Missing phone number in payload' }, { status: 400 });
        }

        // Tentar encontrar o property_id no banco a partir do listingId
        let propertyId = null;
        if (listingIdRaw) {
            // Imovelweb as vezes manda inteiros, converter para string
            const code = String(listingIdRaw);
            const { data: propData } = await supabaseAdmin
                .from('properties')
                .select('id')
                .eq('organization_id', orgId)
                .or(`id.eq.${code},public_code.eq."${code}"`)
                .single();

            if (propData) {
                propertyId = propData.id;
            }
        }

        // 5. Lógica de Criação de Lead (Substituindo a RPC portal_create_lead)
        const phoneNorm = phone.replace(/[^0-9]/g, '').slice(0, 32);

        // 5.1 Buscar contato existente por telefone normalizado
        const { data: existingContact } = await supabaseAdmin
            .from('contacts')
            .select('id, email')
            .eq('organization_id', orgId)
            .ilike('phone', `%${phoneNorm}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        let contactId: string;
        let isNewContact = false;

        if (existingContact) {
            contactId = existingContact.id;
            if (!existingContact.email && email) {
                await supabaseAdmin
                    .from('contacts')
                    .update({ email, updated_at: new Date().toISOString() })
                    .eq('id', contactId);
            }
        } else {
            isNewContact = true;
            const { data: newContact, error: createError } = await supabaseAdmin
                .from('contacts')
                .insert({
                    organization_id: orgId,
                    name: name,
                    email: email,
                    phone: phoneNorm,
                    status: 'new',
                    type: 'lead',
                    notes: `[Imovelweb ${new Date().toISOString().split('T')[0]}] ${rawMessage}`.slice(0, 1000)
                })
                .select('id')
                .single();

            if (createError || !newContact) {
                console.error('[Webhook Imovelweb] Error creating contact:', createError);
                return NextResponse.json({ error: 'Error creating contact' }, { status: 500 });
            }
            contactId = newContact.id;
        }

        // 5.2 Registrar Evento
        await supabaseAdmin.from('contact_events').insert({
            organization_id: orgId,
            contact_id: contactId,
            type: 'lead_received',
            source: 'imovelweb',
            payload: {
                property_id: propertyId,
                raw_phone: phone,
                phone_normalized: phoneNorm,
                email: email,
                message_preview: rawMessage.slice(0, 200)
            }
        });

        // 5.3 Inserir Mensagem (com deduplicação simples de 1min)
        if (rawMessage) {
            const oneMinAgo = new Date(Date.now() - 60000).toISOString();
            const { data: recentMsg } = await supabaseAdmin
                .from('messages')
                .select('id')
                .eq('organization_id', orgId)
                .eq('contact_id', contactId)
                .eq('body', rawMessage)
                .gt('created_at', oneMinAgo)
                .limit(1)
                .single();

            if (!recentMsg) {
                await supabaseAdmin.from('messages').insert({
                    organization_id: orgId,
                    contact_id: contactId,
                    direction: 'in',
                    channel: 'imovelweb',
                    body: rawMessage
                });
            }
        }

        const rpcResult = {
            contact_id: contactId,
            deduped: !isNewContact,
            message_inserted: !!rawMessage
        };

        // 6. Atualizar a data de última sincronização/recebimento no portal_integrations
        await supabaseAdmin
            .from('portal_integrations')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('organization_id', orgId)
            .eq('portal', 'imovelweb');

        return NextResponse.json({ success: true, result: rpcResult }, { status: 200 });

    } catch (error) {
        console.error('[Webhook Imovelweb] Unhandled error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
