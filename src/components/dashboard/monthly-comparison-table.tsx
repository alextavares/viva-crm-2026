'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Adaptação para aceitar tanto o formato antigo (array) quanto o novo (objeto do RPC)
interface MonthlyMetricsObj {
    currentMonthCaptacoes?: number;
    previousMonthCaptacoes?: number;
    currentMonthRespostas?: number;
    previousMonthRespostas?: number;
    currentMonthVisitas?: number;
    previousMonthVisitas?: number;
    currentMonthVendas?: number;
    previousMonthVendas?: number;
}

export interface MonthlyMetric {
    label: string
    current: number
    previous: number
}

interface MonthlyComparisonTableProps {
    currentMonthName: string
    previousMonthName: string
    metrics: MonthlyMetric[] | MonthlyMetricsObj | any
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
    if (previous === 0 && current === 0) return <span className="text-muted-foreground text-[10px] sm:text-xs font-medium bg-muted/50 px-1.5 py-0.5 rounded-md">—</span>
    if (previous === 0) return <span className="flex items-center justify-end gap-0.5 text-emerald-600 text-[10px] sm:text-xs font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-md"><TrendingUp className="w-3 h-3" /> Novo</span>

    // Calculate percentage difference
    const diff = current - previous
    const pct = Math.round((diff / previous) * 100)

    if (pct === 0) return <span className="flex items-center justify-end gap-0.5 text-muted-foreground text-[10px] sm:text-xs font-medium bg-muted/50 px-1.5 py-0.5 rounded-md"><Minus className="w-3 h-3" /> 0%</span>
    if (pct > 0) return <span className="flex items-center justify-end gap-0.5 text-emerald-600 text-[10px] sm:text-xs font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-md"><TrendingUp className="w-3 h-3" /> +{pct}%</span>
    return <span className="flex items-center justify-end gap-0.5 text-red-500 text-[10px] sm:text-xs font-medium bg-red-500/10 px-1.5 py-0.5 rounded-md"><TrendingDown className="w-3 h-3" /> {pct}%</span>
}

export function MonthlyComparisonTable({ currentMonthName, previousMonthName, metrics }: MonthlyComparisonTableProps) {
    // Normalizar os dados para agrupar nas seções
    let formattedData = {
        captacao: [] as MonthlyMetric[],
        vendas: [] as MonthlyMetric[]
    }

    if (Array.isArray(metrics)) {
        // Formato antigo, vamos apenas agrupar tudo em Vendas como fallback
        formattedData.vendas = metrics
    } else {
        // Formato do RPC
        formattedData.captacao = [
            { label: "Novos Imóveis", current: metrics.currentMonthCaptacoes || 0, previous: metrics.previousMonthCaptacoes || 0 },
            { label: "Novos Leads", current: metrics.currentMonthRespostas || 0, previous: metrics.previousMonthRespostas || 0 }
        ]
        formattedData.vendas = [
            { label: "Visitas", current: metrics.currentMonthVisitas || 0, previous: metrics.previousMonthVisitas || 0 },
            { label: "Vendas", current: metrics.currentMonthVendas || 0, previous: metrics.previousMonthVendas || 0 }
        ]
    }

    const TableGroup = ({ title, items }: { title: string, items: MonthlyMetric[] }) => {
        if (!items || items.length === 0) return null;
        return (
            <>
                <tr className="bg-muted/30">
                    <td colSpan={4} className="py-1 px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</td>
                </tr>
                {items.map((m) => (
                    <tr key={m.label} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-2 text-sm font-medium">{m.label}</td>
                        <td className="py-2.5 px-2 text-right text-sm font-semibold">{m.current}</td>
                        <td className="py-2.5 px-2 text-right text-sm text-muted-foreground">{m.previous}</td>
                        <td className="py-2.5 px-2 text-right whitespace-nowrap">
                            <div className="flex justify-end">
                                <DeltaBadge current={m.current} previous={m.previous} />
                            </div>
                        </td>
                    </tr>
                ))}
            </>
        )
    }

    return (
        <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <table className="w-full">
                <thead>
                    <tr className="border-b">
                        <th className="py-2 px-2 text-left text-xs font-semibold text-muted-foreground w-[40%]">Categoria</th>
                        <th className="py-2 px-2 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">{currentMonthName}</th>
                        <th className="py-2 px-2 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">{previousMonthName}</th>
                        <th className="py-2 px-2 text-right text-xs font-semibold text-muted-foreground">Δ</th>
                    </tr>
                </thead>
                <tbody>
                    {formattedData.captacao.length > 0 && <TableGroup title="Captação" items={formattedData.captacao} />}
                    {formattedData.vendas.length > 0 && <TableGroup title="Vendas" items={formattedData.vendas} />}
                </tbody>
            </table>
        </div>
    )
}
