import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Period = '30d' | '90d' | '12m'
type ReportType = 'properties' | 'contacts' | 'team'

function periodDate(p: Period): Date {
    const now = new Date()
    if (p === '30d') return new Date(now.setDate(now.getDate() - 30))
    if (p === '90d') return new Date(now.setDate(now.getDate() - 90))
    return new Date(now.setFullYear(now.getFullYear() - 1))
}

function toCsv(rows: Record<string, unknown>[]): string {
    if (!rows.length) return ''
    const headers = Object.keys(rows[0])
    const lines = [
        headers.join(';'),
        ...rows.map((row) =>
            headers
                .map((h) => {
                    const val = row[h]
                    if (val === null || val === undefined) return ''
                    const str = String(val).replace(/"/g, '""')
                    return str.includes(';') || str.includes('"') || str.includes('\n')
                        ? `"${str}"`
                        : str
                })
                .join(';')
        ),
    ]
    return lines.join('\n')
}

export async function GET(request: NextRequest) {
    const supabase = await createClient()
    const { searchParams } = request.nextUrl
    const type = (searchParams.get('type') as ReportType) || 'properties'
    const period = (searchParams.get('period') as Period) || '30d'
    const since = periodDate(period).toISOString()

    let csv = ''
    const filename = `relatorio-${type}-${period}-${new Date().toISOString().split('T')[0]}.csv`

    if (type === 'properties') {
        const { data } = await supabase
            .from('properties')
            .select('code, title, type, transaction_type, status, sale_price, rent_price, city, neighborhood, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(1000)

        const rows = (data ?? []).map((p) => ({
            Código: p.code ?? '',
            Título: p.title ?? '',
            Tipo: p.type ?? '',
            Transação: p.transaction_type ?? '',
            Status: p.status ?? '',
            'Preço Venda': p.sale_price ?? '',
            'Preço Aluguel': p.rent_price ?? '',
            Cidade: p.city ?? '',
            Bairro: p.neighborhood ?? '',
            'Cadastrado em': p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '',
        }))
        csv = toCsv(rows)
    }

    if (type === 'contacts') {
        const { data } = await supabase
            .from('contacts')
            .select('name, email, phone, type, status, deal_stage, city, created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(1000)

        const stageLabels: Record<string, string> = {
            lead: 'Lead', interest: 'Interesse', visit: 'Visita', negotiation: 'Negociação',
            closing: 'Fechamento', won: 'Ganho', lost: 'Perdido',
        }

        const rows = (data ?? []).map((c) => ({
            Nome: c.name ?? '',
            Email: c.email ?? '',
            Telefone: c.phone ?? '',
            Tipo: c.type ?? '',
            Status: c.status ?? '',
            Estágio: c.deal_stage ? (stageLabels[c.deal_stage] ?? c.deal_stage) : '',
            Cidade: c.city ?? '',
            'Cadastrado em': c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
        }))
        csv = toCsv(rows)
    }

    if (type === 'team') {
        const { data: members } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .order('full_name')

        const { data: contactsData } = await supabase
            .from('contacts')
            .select('broker_id, deal_stage')
            .gte('created_at', since)
            .not('broker_id', 'is', null)

        const { data: propsData } = await supabase
            .from('properties')
            .select('broker_id')
            .gte('created_at', since)
            .not('broker_id', 'is', null)

        const stats: Record<string, { contacts: number; properties: number; won: number }> = {}
        for (const c of contactsData ?? []) {
            if (!c.broker_id) continue
            stats[c.broker_id] ??= { contacts: 0, properties: 0, won: 0 }
            stats[c.broker_id].contacts++
            if (c.deal_stage === 'won') stats[c.broker_id].won++
        }
        for (const p of propsData ?? []) {
            if (!p.broker_id) continue
            stats[p.broker_id] ??= { contacts: 0, properties: 0, won: 0 }
            stats[p.broker_id].properties++
        }

        const rows = (members ?? []).map((m) => ({
            Corretor: m.full_name ?? '',
            Perfil: m.role ?? '',
            Leads: stats[m.id]?.contacts ?? 0,
            Imóveis: stats[m.id]?.properties ?? 0,
            Ganhos: stats[m.id]?.won ?? 0,
        }))
        csv = toCsv(rows)
    }

    // BOM for Excel UTF-8 compatibility
    const bom = '\uFEFF'
    return new NextResponse(bom + csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}"`,
        },
    })
}
