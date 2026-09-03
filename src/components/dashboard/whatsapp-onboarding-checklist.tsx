"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { setWhatsAppOnboardingCollapsed } from "@/app/actions/settings"
import type { WhatsAppOnboardingSnapshot, WhatsAppOnboardingStep } from "@/lib/whatsapp-onboarding"

const STORAGE_KEY = "dashboard:whatsapp-onboarding-collapsed"

function isSchemaDriftError(message: string) {
  return /whatsapp_onboarding_collapsed|column .* does not exist|schema cache/i.test(message)
}

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
      badgeLabel: "Aguardando",
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

export function WhatsAppOnboardingChecklist({
  snapshot,
  initialCollapsed,
}: {
  snapshot: WhatsAppOnboardingSnapshot
  initialCollapsed: boolean
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const nextStep = snapshot.steps.find((step) => step.state !== "done")

  useEffect(() => {
    setCollapsed(initialCollapsed)
  }, [initialCollapsed])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "1") {
      setCollapsed(true)
    } else if (stored === "0") {
      setCollapsed(false)
    }
  }, [])

  const persistCollapsed = useCallback(async (next: boolean) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
    }

    try {
      const result = await setWhatsAppOnboardingCollapsed({ collapsed: next })
      if (!result.success) {
        if (isSchemaDriftError(result.error)) {
          setErrorMsg(null)
          return
        }
        setErrorMsg(result.error)
        return
      }
      setErrorMsg(null)
    } catch {
      setErrorMsg("Não foi possível atualizar o checklist do WhatsApp agora.")
    }
  }, [])

  const progressPercent = useMemo(() => Math.round((snapshot.doneCount / Math.max(snapshot.steps.length, 1)) * 100), [snapshot.doneCount, snapshot.steps.length])

  return (
    <Card className="border-dashed bg-muted/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">WhatsApp oficial</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {snapshot.doneCount}/{snapshot.steps.length} concluídos
          </p>
          <div className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const next = !collapsed
            setCollapsed(next)
            void persistCollapsed(next)
          }}
        >
          {collapsed ? "Expandir" : "Recolher"}
          {collapsed ? <ChevronDown className="ml-1 h-4 w-4" /> : <ChevronUp className="ml-1 h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="text-sm text-muted-foreground">
          {snapshot.ready
            ? "Canal oficial pronto para uso."
            : "Ainda faltam etapas para liberar o canal oficial."}
        </div>
        {collapsed && nextStep ? (
          <div className="rounded-lg border bg-background/80 px-3 py-2 text-sm">
            <span className="font-medium">Próxima etapa:</span> {nextStep.title}
          </div>
        ) : null}
        {errorMsg ? <div className="text-sm text-red-600">{errorMsg}</div> : null}

        {!collapsed ? (
          <div className="grid gap-3">
            {snapshot.steps.map((step) => {
              const meta = stateMeta(step)
              const Icon = meta.icon

              return (
                <div key={step.id} className="flex items-start justify-between gap-3 rounded-xl border bg-card/50 p-3">
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
                      Faça a etapa acima
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

