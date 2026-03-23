import Link from "next/link"
import { AlertCircle, CalendarCheck, Clock, Inbox } from "lucide-react"

type Props = {
    newLeadsCount: number
    slaOverdueCount: number
    pendingFollowupsCount: number
    todayActivitiesCount: number
}

type StripCard = {
    label: string
    count: number
    subtitle: string
    href: string
    icon: React.ReactNode
    color: string
    countColor: string
}

export function DashboardOperationalStrip({
    newLeadsCount,
    slaOverdueCount,
    pendingFollowupsCount,
    todayActivitiesCount,
}: Props) {
    const cards: StripCard[] = [
        {
            label: "Leads novos",
            count: newLeadsCount,
            subtitle: "Aguardando primeiro contato",
            href: "/contacts?status=new&view=list",
            icon: <Inbox className="h-5 w-5" />,
            color: "border-l-blue-500",
            countColor: "text-blue-600",
        },
        {
            label: "Leads em atraso",
            count: slaOverdueCount,
            subtitle: "Fora do SLA de resposta",
            href: "/contacts?status=new&sla=overdue&view=list",
            icon: <AlertCircle className="h-5 w-5" />,
            color: "border-l-rose-500",
            countColor: "text-rose-600",
        },
        {
            label: "Follow-ups pendentes",
            count: pendingFollowupsCount,
            subtitle: "Vencidos ou para hoje",
            href: "/contacts?followup=pending&view=list",
            icon: <Clock className="h-5 w-5" />,
            color: "border-l-amber-500",
            countColor: "text-amber-600",
        },
        {
            label: "Atividades do dia",
            count: todayActivitiesCount,
            subtitle: "Compromissos agendados",
            href: "/appointments",
            icon: <CalendarCheck className="h-5 w-5" />,
            color: "border-l-emerald-500",
            countColor: "text-emerald-600",
        },
    ]

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
                <Link
                    key={card.label}
                    href={card.href}
                    className={`group flex items-start gap-3 rounded-lg border border-l-4 ${card.color} bg-card p-3.5 transition-colors hover:bg-accent/50`}
                >
                    <div className="mt-0.5 text-muted-foreground group-hover:text-foreground transition-colors">
                        {card.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium truncate">{card.label}</span>
                            <span className={`text-xl font-bold tabular-nums ${card.countColor}`}>
                                {card.count}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{card.subtitle}</p>
                    </div>
                </Link>
            ))}
        </div>
    )
}
