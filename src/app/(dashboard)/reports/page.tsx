import { createClient } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Download } from 'lucide-react'

type Period = '30d' | '90d' | '12m'

interface PageProps {
    searchParams: Promise<{ period?: string; tab?: string }>
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

const DEAL_STAGE_LABELS: Record<string, string> = {
    lead: 'Lead', interest: 'Interesse', visit: 'Visita', negotiation: 'Negociação',
    closing: 'Fechamento', won: 'Ganho', lost: 'Perdido',
}

export default async function ReportsPage({ searchParams }: PageProps) {
    const sp = await searchParams
    const period = (sp.period as Period) || '30d'
    const activeTab = sp.tab || 'properties'
    const since = periodDate(period).toISOString()

    const supabase = await createClient()

    // ---- Properties report ----
    const { data: properties } = await supabase
        .from('properties')
        .select('id, title, code, type, transaction_type, status, sale_price, rent_price, city, neighborhood, created_at, profiles!broker_id(full_name)')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200)

    // ---- Contacts report ----
    const { data: contacts } = await supabase
        .from('contacts')
        .select('id, name, email, phone, type, status, deal_stage, city, created_at, profiles!broker_id(full_name)')
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
        .select('broker_id')
        .gte('created_at', since)
        .not('broker_id', 'is', null)

    const { data: propertiesPerBroker } = await supabase
        .from('properties')
        .select('broker_id')
        .gte('created_at', since)
        .not('broker_id', 'is', null)

    const { data: wonDealsPerBroker } = await supabase
        .from('contacts')
        .select('broker_id')
        .gte('created_at', since)
        .eq('deal_stage', 'won')
        .not('broker_id', 'is', null)

    // Aggregate by broker
    const brokerStats: Record<string, { contacts: number; properties: number; won: number }> = {}
    for (const c of contactsPerBroker ?? []) {
        if (!c.broker_id) continue
        brokerStats[c.broker_id] ??= { contacts: 0, properties: 0, won: 0 }
        brokerStats[c.broker_id].contacts++
    }
    for (const p of propertiesPerBroker ?? []) {
        if (!p.broker_id) continue
        brokerStats[p.broker_id] ??= { contacts: 0, properties: 0, won: 0 }
        brokerStats[p.broker_id].properties++
    }
    for (const w of wonDealsPerBroker ?? []) {
        if (!w.broker_id) continue
        brokerStats[w.broker_id] ??= { contacts: 0, properties: 0, won: 0 }
        brokerStats[w.broker_id].won++
    }

    const periods: Period[] = ['30d', '90d', '12m']

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Relatórios</h1>
                    <p className="text-muted-foreground">Visão analítica do seu CRM.</p>
                </div>
                <div className="flex items-center gap-2">
                    {periods.map((p) => (
                        <Link
                            key={p}
                            href={`/reports?period=${p}&tab=${activeTab}`}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${period === p
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {periodLabel(p)}
                        </Link>
                    ))}
                </div>
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
                    </TabsList>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/reports/export?type=${activeTab}&period=${period}`}>
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
                                                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{p.code || '—'}</td>
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
                                                    {formatCurrency(p.sale_price ?? p.rent_price)}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <Badge variant="secondary">{p.status || '—'}</Badge>
                                                </td>
                                                <td className="px-4 py-2">{p.city || '—'}</td>
                                                <td className="px-4 py-2 text-muted-foreground">
                                                    {((p as any).profiles?.full_name) || "-"}
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
                                                    {((c as any).profiles?.full_name) || "-"}
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
                                                        <Badge variant="outline">{m.role || '—'}</Badge>
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
            </Tabs>
        </div>
    )
}
