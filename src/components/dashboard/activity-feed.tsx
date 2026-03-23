"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, MessageSquare, Phone, UserPlus, CheckCircle2 } from "lucide-react"

const activities = [
    {
        id: 1,
        type: "lead_created",
        title: "Novo Lead Cadastrado",
        description: "Carlos Oliveira se interessou por Cobertura no Gonzaga",
        time: "Há 10 minutos",
        icon: UserPlus,
        color: "text-blue-500",
        bgColor: "bg-blue-50/50 dark:bg-blue-500/10",
        borderColor: "border-blue-200 dark:border-blue-900",
    },
    {
        id: 2,
        type: "property_view",
        title: "Visita Agendada",
        description: "Visita confirmada com Ana Paula amanhã às 10:00",
        time: "Há 2 horas",
        icon: Home,
        color: "text-emerald-500",
        bgColor: "bg-emerald-50/50 dark:bg-emerald-500/10",
        borderColor: "border-emerald-200 dark:border-emerald-900",
    },
    {
        id: 3,
        type: "deal_won",
        title: "Negócio Fechado!",
        description: "Contrato assinado para Locação de Apartamento no Boqueirão",
        time: "Há 3 horas",
        icon: CheckCircle2,
        color: "text-amber-500",
        bgColor: "bg-amber-50/50 dark:bg-amber-500/10",
        borderColor: "border-amber-200 dark:border-amber-900",
    },
    {
        id: 4,
        type: "message_sent",
        title: "Mensagem Enviada",
        description: "Você enviou uma proposta para Roberto Moreira via WhatsApp",
        time: "Há 4 horas",
        icon: MessageSquare,
        color: "text-indigo-500",
        bgColor: "bg-indigo-50/50 dark:bg-indigo-500/10",
        borderColor: "border-indigo-200 dark:border-indigo-900",
    },
    {
        id: 5,
        type: "call_made",
        title: "Ligação Realizada",
        description: "Contato com proprietário (Apartamento Bela Vista)",
        time: "Ontem, 16:30",
        icon: Phone,
        color: "text-orange-500",
        bgColor: "bg-orange-50/50 dark:bg-orange-500/10",
        borderColor: "border-orange-200 dark:border-orange-900",
    }
]

export function ActivityFeed() {
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="text-lg">Atividades Recentes</CardTitle>
                <CardDescription>Acompanhe tudo o que acontece no sistema.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6 pl-2">
                    {activities.map((activity, index) => {
                        const Icon = activity.icon;
                        const isLast = index === activities.length - 1;
                        return (
                            <div key={activity.id} className="relative flex gap-4">
                                {/* Timeline line */}
                                {!isLast && (
                                    <div className="absolute left-[15px] top-10 bottom-[-24px] w-[2px] bg-muted"></div>
                                )}

                                <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm ${activity.bgColor} ${activity.borderColor}`}>
                                    <Icon className={`h-4 w-4 ${activity.color}`} />
                                </div>
                                <div className="flex flex-col space-y-1 pb-1">
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="text-sm font-semibold leading-none text-foreground">{activity.title}</p>
                                        <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-0.5 rounded-full">{activity.time}</p>
                                    </div>
                                    <p className="text-sm text-muted-foreground/80 line-clamp-2 mt-1">
                                        {activity.description}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
