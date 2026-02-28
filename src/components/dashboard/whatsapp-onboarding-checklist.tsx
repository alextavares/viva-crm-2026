"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { WhatsAppOnboardingSnapshot, WhatsAppOnboardingStep } from "@/lib/whatsapp-onboarding"

function stateMeta(step: WhatsAppOnboardingStep) {
  if (step.state === "done") {
    return {
      icon: CheckCircle2,
      iconClass: "mt-0.5 h-5 w-5 text-emerald-500",
      badgeClass: "border-emerald-200 bg-emerald-100 text-emerald-800",
      badgeLabel: "Concluído",
      canAct: true,
    }
  }

  if (step.state === "blocked") {
    return {
      icon: Lock,
      iconClass: "mt-0.5 h-5 w-5 text-amber-600",
      badgeClass: "border-amber-200 bg-amber-100 text-amber-800",
      badgeLabel: "Bloqueado",
      canAct: false,
    }
  }

  return {
    icon: Circle,
    iconClass: "mt-0.5 h-5 w-5 text-muted-foreground",
    badgeClass: "border-zinc-200 bg-zinc-100 text-zinc-700",
    badgeLabel: "Pendente",
    canAct: true,
  }
}

export function WhatsAppOnboardingChecklist({ snapshot }: { snapshot: WhatsAppOnboardingSnapshot }) {
  const [collapsed, setCollapsed] = useState(false)

  const progressPercent = useMemo(() => Math.round((snapshot.doneCount / Math.max(snapshot.steps.length, 1)) * 100), [snapshot.doneCount, snapshot.steps.length])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Onboarding WhatsApp Oficial</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {snapshot.doneCount}/{snapshot.steps.length} concluídos
          </p>
          <div className="mt-2 h-2 w-44 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? "Expandir" : "Recolher"}
          {collapsed ? <ChevronDown className="ml-1 h-4 w-4" /> : <ChevronUp className="ml-1 h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">
          {snapshot.ready
            ? "Canal oficial pronto para uso."
            : "Complete os passos para liberar envio oficial sem suporte manual."}
        </div>

        {!collapsed ? (
          <div className="grid gap-3">
            {snapshot.steps.map((step) => {
              const meta = stateMeta(step)
              const Icon = meta.icon

              return (
                <div key={step.id} className="flex items-start justify-between gap-3 rounded-2xl border bg-card/50 p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={meta.iconClass} />
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span>{step.title}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.badgeClass}`}>
                          {meta.badgeLabel}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">{step.description}</div>
                    </div>
                  </div>

                  {meta.canAct ? (
                    <Link
                      href={step.href}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-foreground ring-1 ring-border hover:bg-accent"
                    >
                      {step.cta}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground ring-1 ring-border">
                      Depende do passo anterior
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

