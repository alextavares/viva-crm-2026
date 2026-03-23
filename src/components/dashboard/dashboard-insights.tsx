"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Lightbulb, TrendingUp } from "lucide-react"

export function DashboardInsights() {
    // These could be fetched from an API in a real implementation
    const insights = [
        {
            id: 1,
            type: 'warning',
            title: "Leads Pendentes",
            description: "Você possui 2 leads da última semana sem nenhum contato registrado. Acesse a área de Contatos para atendê-los.",
            icon: <AlertCircle className="h-4 w-4 text-amber-500" />
        },
        {
            id: 2,
            type: 'tip',
            title: "Oportunidade de Fechamento",
            description: "O contato com 'Maria Silva' está na etapa de Negociação há 15 dias. Que tal oferecer uma nova visita?",
            icon: <Lightbulb className="h-4 w-4 text-emerald-500" />
        },
        {
            id: 3,
            type: 'info',
            title: "Performance em Alta",
            description: "Suas captações aumentaram 20% este mês em comparação com o mês passado.",
            icon: <TrendingUp className="h-4 w-4 text-blue-500" />
        }
    ]

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-muted-foreground" />
                    Sugestões e Avisos
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">
                    {insights.map((insight) => (
                        <div key={insight.id} className="flex gap-3 items-start border-l-2 pl-3 pb-1" style={{ borderColor: insight.type === 'warning' ? '#f59e0b' : insight.type === 'tip' ? '#10b981' : '#3b82f6' }}>
                            <div className="mt-0.5">
                                {insight.icon}
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-medium">{insight.title}</span>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {insight.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
