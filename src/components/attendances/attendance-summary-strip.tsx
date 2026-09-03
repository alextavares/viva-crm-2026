import { AlertTriangle, CalendarClock, ListChecks, MessageCircle, UserCheck } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AttendanceMetrics } from "@/lib/attendances/attendance-metrics"

type Props = {
  metrics: AttendanceMetrics
}

const items = [
  {
    key: "total",
    title: "Atendimentos no recorte",
    icon: ListChecks,
  },
  {
    key: "newWithoutContact",
    title: "Novos sem primeiro contato",
    icon: MessageCircle,
  },
  {
    key: "inProgress",
    title: "Em atendimento",
    icon: UserCheck,
  },
  {
    key: "overdue",
    title: "SLA atrasado",
    icon: AlertTriangle,
  },
  {
    key: "upcomingVisits",
    title: "Visitas futuras",
    icon: CalendarClock,
  },
] as const

export function AttendanceSummaryStrip({ metrics }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <Card key={item.key} className="rounded-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{item.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-semibold">{metrics[item.key]}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
