'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    PieChart,
    Pie,
    Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DashboardChartsProps {
    propertiesByStatus: { name: string; value: number }[]
    leadsByType: { name: string; value: number }[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

function ChartSlot({
    children,
    emptyText = "Sem dados para exibir.",
    hasData,
}: {
    children: (size: { width: number; height: number }) => React.ReactNode
    emptyText?: string
    hasData: boolean
}) {
    const ref = useRef<HTMLDivElement | null>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })

    useEffect(() => {
        const node = ref.current
        if (!node) return

        const update = () => {
            const rect = node.getBoundingClientRect()
            setSize({
                width: Math.max(0, Math.floor(rect.width)),
                height: Math.max(0, Math.floor(rect.height)),
            })
        }

        update()
        const ro = new ResizeObserver(update)
        ro.observe(node)
        return () => ro.disconnect()
    }, [])

    const ready = size.width > 0 && size.height > 0

    return (
        <div ref={ref} className={`w-full min-w-0 ${hasData ? "h-[240px] sm:h-[300px]" : "h-[140px] sm:h-[180px]"}`}>
            {!hasData ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {emptyText}
                </div>
            ) : ready ? (
                children(size)
            ) : (
                <div className="h-full w-full animate-pulse rounded-md bg-muted/30" />
            )}
        </div>
    )
}

export function DashboardCharts({ propertiesByStatus, leadsByType }: DashboardChartsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-1 min-w-0">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Imóveis por Status</CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                    <ChartSlot
                        hasData={propertiesByStatus.length > 0}
                        emptyText="Ainda não há imóveis suficientes para montar este gráfico."
                    >
                        {({ width, height }) => (
                            <BarChart width={width} height={height} data={propertiesByStatus}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="value" name="Quantidade" fill="#adfa1d" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        )}
                    </ChartSlot>
                </CardContent>
            </Card>

            <Card className="col-span-1 min-w-0">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Leads por Tipo</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartSlot
                        hasData={leadsByType.length > 0}
                        emptyText="Assim que entrarem leads ou clientes, a distribuição aparece aqui."
                    >
                        {({ width, height }) => (
                            <PieChart width={width} height={height}>
                                <Pie
                                    data={leadsByType}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                    outerRadius={Math.max(56, Math.min(110, Math.floor(Math.min(width, height) * 0.28)))}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {leadsByType.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        )}
                    </ChartSlot>
                </CardContent>
            </Card>
        </div>
    )
}
