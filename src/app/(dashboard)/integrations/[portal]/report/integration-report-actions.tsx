"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { analyzePortalIntegrationIssues } from "@/app/actions/integrations"
import { Button } from "@/components/ui/button"
import type { PortalKey } from "@/lib/integrations"

export function IntegrationReportActions({
  portal,
  canManage,
}: {
  portal: PortalKey
  canManage: boolean
}) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (!canManage) return null

  const runAnalysis = () => {
    setErrorMsg(null)

    startTransition(() => {
      void (async () => {
        const result = await analyzePortalIntegrationIssues({ portal })

        if (!result.success) {
          setErrorMsg(result.error)
          toast.error(result.error)
          return
        }

        const summary = result.data
        toast.success(
          summary
            ? `Análise concluída: ${summary.blockerCount} bloqueiam, ${summary.warningCount} recomendadas.`
            : "Análise concluída."
        )
        router.refresh()
      })()
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={runAnalysis}>
        {isPending ? "Analisando..." : "Analisar pendências"}
      </Button>
      {errorMsg ? <p className="text-right text-xs text-red-600">{errorMsg}</p> : null}
    </div>
  )
}
