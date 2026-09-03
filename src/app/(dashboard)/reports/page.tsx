import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LeadAttributionTable } from '@/components/analytics/lead-attribution-table'
import {
    loadLeadAttributionMetrics,
    type AttributionPeriod,
} from '@/lib/analytics/lead-attribution'
import { OperationalFunnelTable } from '@/components/analytics/operational-funnel-table'
import {
    loadOperationalFunnelMetrics,
    type FunnelPeriod,
} from '@/lib/analytics/operational-funnel'
import Link from 'next/link'
import { Download } from 'lucide-react'

type Period = '30d' | '90d' | '12m'
type ReportTab = 'properties' | 'contacts' | 'team' | 'attribution' | 'funnel'

interface PageProps {
    searchParams: Promise<{ period?: string; tab?: string; attributionPeriod?: string; funnelPeriod?: string }>
}

function periodLabel(p: Period) {
    const labels: Record<Period, string> = { '30d': '30 dias', '90d': '90 dias', '12m': '12 meses' }
    return labels[p]
}

function periodDate(p: Period): Date {
    const now = new Date()
    if (p === '30d') return new Date(now.setDate(now.getDate() - 30))
    if (p === '90d') return new Date(now.setDate(now.getDate() - 90))
    return new Date(now.setFullYear(now.getFullYear() - 1))
}

function formatCurrency(value: number | null | undefined) {
    if (!value) return '—'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

function parseAttributionPeriod(value: string | undefined): AttributionPeriod {
    return value === 'today' || value === '7d' || value === '30d' ? value : '7d'
}

function attributionPeriodLabel(period: AttributionPeriod) {
    const labels: Record<AttributionPeriod, string> = {
        today: 'Hoje',
        '7d': '7 dias',
        '30d': '30 dias',
    }

    return labels[period]
}

function parseFunnelPeriod(value: string | undefined): FunnelPeriod {
    return value === 'today' || value === '7d' || value === '30d' ? value : '7d'
}

function funnelPeriodLabel(period: FunnelPeriod) {
    const labels: Record<FunnelPeriod, string> = {
        today: 'Hoje',
        '7d': '7 dias',
        '30d': '30 dias',
    }

    return labels[period]
}

const DEAL_STAGE_LABELS: Record<string, string> = {
    lead: 'Lead', interest: 'Interesse', visit: 'Visita', negotiation: 'Negociação',
    closing: 'Fechamento', won: 'Ganho', lost: 'Perdido',
}

const ROLE_LABELS: Record<string, string> = {
    owner: 'Dono da conta',
    manager: 'Gestor',
    broker: 'Corretor',
    assistant: 'Assistente',
}

export default async function ReportsPage({ searchParams }: PageProps) {
    const sp = await searchParams
    const period = (sp.period as Period) || '30d'
    const requestedTab = (sp.tab as ReportTab) || 'properties'
    const attributionPeriod = parseAttributionPeriod(sp.attributionPeriod)
    const funnelPeriod = parseFunnelPeriod(sp.funnelPeriod)
    const since = periodDate(period).toISOString()

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { data: profile } = user
        ? await supabase
              .from('profiles')
              .select('organization_id, role')
              .eq('id', user.id)
              .single()
        : { data: null }

    const organizationId = profile?.organization_id ?? null
    const role = profile?.role ?? null
    const isAdmin = role === 'owner' || role === 'manager'
    const activeTab =
        (requestedTab === 'attribution' || requestedTab === 'funnel') && !isAdmin
            ? 'properties'
            : requestedTab

    // ---- Properties report ----
    const { data: properties } = await supabase
        .from('properties')
        .select('id, title, public_code, type, transaction_type, status, price, address, created_at, assigned_to')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200)

    // ---- Contacts report ----
    const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, email, phone, type, status, deal_stage, city, created_at, assigned_to')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200)

    // ---- Team report ----
    const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .order('full_name')

    // Count contacts per broker
    const { data: contactsPerBroker } = await supabase
        .from('contacts')
        .select('assigned_to')
        .gte('created_at', since)
        .not('assigned_to', 'is', null)

    const { data: propertiesPerBroker } = await supabase
        .from('properties')
        .select('assigned_to')
        .gte('created_at', since)
        .not('assigned_to', 'is', null)

    const { data: wonDealsPerBroker } = await supabase
        .from('contacts')
        .select('assigned_to')
        .gte('created_at', since)
        .eq('deal_stage', 'won')
        .not('assigned_to', 'is', null)

    // Aggregate by broker
    const brokerStats: Record<string, { contacts: number; properties: number; won: number }> = {}
    for (const c of contactsPerBroker ?? []) {
        if (!c.assigned_to) continue
        brokerStats[c.assigned_to] ??= { contacts: 0, properties: 0, won: 0 }
        brokerStats[c.assigned_to].contacts++
    }
    for (const p of propertiesPerBroker ?? []) {
        if (!p.assigned_to) continue
        brokerStats[p.assigned_to] ??= { contacts: 0, properties: 0, won: 0 }
        brokerStats[p.assigned_to].properties++
    }
    for (const w of wonDealsPerBroker ?? []) {
        if (!w.assigned_to) continue
        brokerStats[w.assigned_to] ??= { contacts: 0, properties: 0, won: 0 }
        brokerStats[w.assigned_to].won++
    }

    const profileNameById = Object.fromEntries(
        (teamMembers ?? []).map((member) => [member.id, member.full_name || "-"])
    )

    const attributionMetrics = isAdmin
        ? await loadLeadAttributionMetrics(supabase, organizationId, attributionPeriod)
        : null
    const operationalFunnelMetrics = isAdmin
        ? await loadOperationalFunnelMetrics(supabase, organizationId, funnelPeriod)
        : null

    const periods: Period[] = ['30d', '90d', '12m']
    const attributionPeriods: AttributionPeriod[] = ['today', '7d', '30d']
    const funnelPeriods: FunnelPeriod[] = ['today', '7d', '30d']
    const exportHref =
        activeTab === 'attribution'
            ? `/reports/export?type=attribution&attributionPeriod=${attributionPeriod}`
            : activeTab === 'funnel'
                ? `/reports/export?type=funnel&funnelPeriod=${funnelPeriod}`
            : `/reports/export?type=${activeTab}&period=${period}`

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Relatórios</h1>
                    <p className="text-muted-foreground">Acompanhe origem, carteira e evolução dos atendimentos.</p>
                </div>
                {activeTab !== 'attribution' && activeTab !== 'funnel' ? (
                    <div className="flex items-center gap-2">
                        {periods.map((p) => (
                            <Link
                                key={p}
                                href={`/reports?period=${p}&tab=${activeTab}&attributionPeriod=${attributionPeriod}&funnelPeriod=${funnelPeriod}`}
                                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${period === p
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {periodLabel(p)}
                            </Link>
                        ))}
                    </div>
                ) : null}
            </div>

            <Tabs defaultValue={activeTab}>
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="properties" asChild>
                            <Link href={`/reports?period=${period}&tab=properties`}>Imóveis</Link>
                        </TabsTrigger>
                        <TabsTrigger value="contacts" asChild>
                            <Link href={`/reports?period=${period}&tab=contacts`}>Contatos</Link>
                        </TabsTrigger>
                        <TabsTrigger value="team" asChild>
                            <Link href={`/reports?period=${period}&tab=team`}>Equipe</Link>
                        </TabsTrigger>
                        {isAdmin ? (
                            <TabsTrigger value="attribution" asChild>
                                <Link href={`/reports?tab=attribution&period=${period}&attributionPeriod=${attributionPeriod}&funnelPeriod=${funnelPeriod}`}>Origem dos fechamentos</Link>
                            </TabsTrigger>
                        ) : null}
                        {isAdmin ? (
                            <TabsTrigger value="funnel" asChild>
                                <Link href={`/reports?tab=funnel&period=${period}&attributionPeriod=${attributionPeriod}&funnelPeriod=${funnelPeriod}`}>Funil</Link>
                            </TabsTrigger>
                        ) : null}
                    </TabsList>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={exportHref}>
                            <Download className="mr-2 h-4 w-4" />
                            Exportar CSV
                        </Link>
                    </Button>
                </div>

                {/* Imóveis */}
                <TabsContent value="properties" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Imóveis cadastrados ({properties?.length ?? 0})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40">
                                            <th className="px-4 py-2 text-left font-medium">Código</th>
                                            <th className="px-4 py-2 text-left font-medium">Título</th>
                                            <th className="px-4 py-2 text-left font-medium">Tipo</th>
                                            <th className="px-4 py-2 text-left font-medium">Transação</th>
                                            <th className="px-4 py-2 text-left font-medium">Valor</th>
                                            <th className="px-4 py-2 text-left font-medium">Status</th>
                                            <th className="px-4 py-2 text-left font-medium">Cidade</th>
                                            <th className="px-4 py-2 text-left font-medium">Corretor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(properties ?? []).map((p) => (
                                            <tr key={p.id} className="border-b hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{p.public_code || '—'}</td>
                                                <td className="px-4 py-2 max-w-[180px] truncate">
                                                    <Link href={`/properties/${p.id}`} className="hover:underline text-primary">
                                                        {p.title || '(sem título)'}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-2">{p.type || '—'}</td>
                                                <td className="px-4 py-2">
                                                    <Badge variant="outline">{p.transaction_type || '—'}</Badge>
                                                </td>
                                                <td className="px-4 py-2 text-right tabular-nums">
                                                    {formatCurrency(p.price)}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <Badge variant="secondary">{p.status || '—'}</Badge>
                                                </td>
                                                <td className="px-4 py-2">{(p.address as { city?: string | null } | null)?.city || '—'}</td>
                                                <td className="px-4 py-2 text-muted-foreground">
                                                    {profileNameById[p.assigned_to || ""] || "-"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {(properties ?? []).length === 0 && (
                                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                                        Nenhum imóvel no período selecionado.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Contatos */}
                <TabsContent value="contacts" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Contatos / Leads ({contacts?.length ?? 0})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40">
                                            <th className="px-4 py-2 text-left font-medium">Nome</th>
                                            <th className="px-4 py-2 text-left font-medium">Tipo</th>
                                            <th className="px-4 py-2 text-left font-medium">Status</th>
                                            <th className="px-4 py-2 text-left font-medium">Estágio</th>
                                            <th className="px-4 py-2 text-left font-medium">Cidade</th>
                                            <th className="px-4 py-2 text-left font-medium">Corretor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(contacts ?? []).map((c) => (
                                            <tr key={c.id} className="border-b hover:bg-muted/20 transition-colors">
                                                <td className="px-4 py-2">
                                                    <Link href={`/contacts/${c.id}`} className="hover:underline text-primary">
                                                        {c.name || '(sem nome)'}
                                                    </Link>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <Badge variant="outline">{c.type || '—'}</Badge>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <Badge variant="secondary">{c.status || '—'}</Badge>
                                                </td>
                                                <td className="px-4 py-2">
                                                    {c.deal_stage ? DEAL_STAGE_LABELS[c.deal_stage] ?? c.deal_stage : '—'}
                                                </td>
                                                <td className="px-4 py-2">{c.city || '—'}</td>
                                                <td className="px-4 py-2 text-muted-foreground">
                                                    {profileNameById[c.assigned_to || ""] || "-"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {(contacts ?? []).length === 0 && (
                                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                                        Nenhum contato no período selecionado.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Equipe */}
                <TabsContent value="team" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Desempenho por Corretor</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-muted/40">
                                            <th className="px-4 py-2 text-left font-medium">Corretor</th>
                                            <th className="px-4 py-2 text-left font-medium">Perfil</th>
                                            <th className="px-4 py-2 text-center font-medium">Leads</th>
                                            <th className="px-4 py-2 text-center font-medium">Imóveis</th>
                                            <th className="px-4 py-2 text-center font-medium">Ganhos</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(teamMembers ?? []).map((m) => {
                                            const stats = brokerStats[m.id] ?? { contacts: 0, properties: 0, won: 0 }
                                            return (
                                                <tr key={m.id} className="border-b hover:bg-muted/20 transition-colors">
                                                    <td className="px-4 py-2 font-medium">{m.full_name || '—'}</td>
                                                    <td className="px-4 py-2">
                                                        <Badge variant="outline">{ROLE_LABELS[m.role || ''] ?? m.role ?? '—'}</Badge>
                                                    </td>
                                                    <td className="px-4 py-2 text-center tabular-nums">{stats.contacts}</td>
                                                    <td className="px-4 py-2 text-center tabular-nums">{stats.properties}</td>
                                                    <td className="px-4 py-2 text-center tabular-nums">
                                                        {stats.won > 0 ? (
                                                            <span className="font-semibold text-emerald-600">{stats.won}</span>
                                                        ) : (
                                                            <span className="text-muted-foreground">0</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                                {(teamMembers ?? []).length === 0 && (
                                    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                                        Nenhum membro na equipe.
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {isAdmin ? (
                    <TabsContent value="attribution" className="mt-4">
                        <Card>
                            <CardHeader className="space-y-4">
                                <div>
                                    <CardTitle className="text-base">Atribuição de fechamentos</CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                        Mostra quais canais geraram fechamentos no período.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {attributionPeriods.map((value) => (
                                        <Link
                                            key={value}
                                            href={`/reports?tab=attribution&period=${period}&attributionPeriod=${value}&funnelPeriod=${funnelPeriod}`}
                                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                                attributionPeriod === value
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {attributionPeriodLabel(value)}
                                        </Link>
                                    ))}
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-lg border bg-muted/30 p-4">
                                        <div className="text-xs text-muted-foreground">Fechamentos</div>
                                        <div className="mt-1 text-2xl font-semibold">
                                            {attributionMetrics?.totals.closedCount ?? 0}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border bg-muted/30 p-4">
                                        <div className="text-xs text-muted-foreground">Valor total</div>
                                        <div className="mt-1 text-2xl font-semibold">
                                            {formatCurrency(attributionMetrics?.totals.closedValue ?? 0)}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <LeadAttributionTable
                                    metrics={attributionMetrics ?? {
                                        period: attributionPeriod,
                                        rows: [],
                                        byOrigin: [],
                                        totals: { closedCount: 0, closedValue: 0 },
                                    }}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                ) : null}

                {isAdmin ? (
                    <TabsContent value="funnel" className="mt-4">
                        <Card>
                            <CardHeader className="space-y-4">
                                <div>
                                    <CardTitle className="text-base">Funil operacional</CardTitle>
                                    <p className="text-sm text-muted-foreground">
                                        Leads recebidos no período e avanço pelas etapas comerciais.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {funnelPeriods.map((value) => (
                                        <Link
                                            key={value}
                                            href={`/reports?tab=funnel&period=${period}&attributionPeriod=${attributionPeriod}&funnelPeriod=${value}`}
                                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                                                funnelPeriod === value
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-muted text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {funnelPeriodLabel(value)}
                                        </Link>
                                    ))}
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <div className="text-xs text-muted-foreground">Leads recebidos</div>
                                    <div className="mt-1 text-2xl font-semibold">
                                        {operationalFunnelMetrics?.totalLeads ?? 0}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <OperationalFunnelTable
                                    metrics={operationalFunnelMetrics ?? {
                                        period: funnelPeriod,
                                        totalLeads: 0,
                                        stages: [],
                                    }}
                                />
                            </CardContent>
                        </Card>
                    </TabsContent>
                ) : null}
            </Tabs>
        </div>
    )
}
