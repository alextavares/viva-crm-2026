import { Bot, TimerReset, UserRoundCheck, WandSparkles } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AiLeadOperationsMetrics } from "@/lib/ai-leads/metrics"

type Props = {
  metrics: AiLeadOperationsMetrics
}

const ITEMS = [
  {
    key: "openedToday" as const,
    label: "Sessões abertas hoje",
    icon: Bot,
    suffix: "",
  },
  {
    key: "qualifiedToday" as const,
    label: "Qualificadas hoje",
    icon: WandSparkles,
    suffix: "",
  },
  {
    key: "handoffsToday" as const,
    label: "Handoffs hoje",
    icon: UserRoundCheck,
    suffix: "",
  },
  {
    key: "avgHandoffMinutes" as const,
    label: "Tempo médio até handoff",
    icon: TimerReset,
    suffix: " min",
  },
]

export function AiLeadsMetrics({ metrics }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {ITEMS.map((item) => {
        const Icon = item.icon
        const rawValue = metrics[item.key]
        const value = rawValue === null ? "—" : `${rawValue}${item.suffix}`

        return (
          <Card key={item.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
