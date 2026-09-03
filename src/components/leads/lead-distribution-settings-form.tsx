"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { saveLeadDistributionSettings } from "@/app/actions/settings"
import { redistributeOverdueLeadsNow } from "@/app/actions/followups"

type SettingsRow = {
  organization_id: string
  enabled: boolean
  mode: "round_robin"
  sla_minutes: number
  redistribute_overdue: boolean
}

type Props = {
  canManage: boolean
  tableReady: boolean
  initial: SettingsRow
}

export function LeadDistributionSettingsForm({ canManage, tableReady, initial }: Props) {
  const initialSlaMinutes = Math.min(Math.max(initial.sla_minutes || 15, 1), 1440)
  const [savedSettings, setSavedSettings] = useState({
    enabled: Boolean(initial.enabled),
    slaMinutes: initialSlaMinutes,
    redistributeOverdue: Boolean(initial.redistribute_overdue),
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [enabled, setEnabled] = useState(savedSettings.enabled)
  const [slaMinutes, setSlaMinutes] = useState<string | number>(savedSettings.slaMinutes)
  const [redistributeOverdue, setRedistributeOverdue] = useState(savedSettings.redistributeOverdue)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const isBusy = isPending || isProcessing
  const normalizedSlaMinutes = Math.min(Math.max(Number(slaMinutes) || 15, 1), 1440)
  const hasChanges =
    enabled !== savedSettings.enabled ||
    normalizedSlaMinutes !== savedSettings.slaMinutes ||
    redistributeOverdue !== savedSettings.redistributeOverdue

  const save = async () => {
    if (!canManage || !tableReady) return
    setErrorMsg(null)
    const safeSla = normalizedSlaMinutes

    startTransition(() => {
      void (async () => {
        const result = await saveLeadDistributionSettings({
          enabled,
          slaMinutes: safeSla,
          redistributeOverdue,
        })

        if (!result.success) {
          setErrorMsg(result.error)
          toast.error(result.error)
          return
        }

        setSlaMinutes(safeSla)
        setSavedSettings({
          enabled,
          slaMinutes: safeSla,
          redistributeOverdue,
        })
        toast.success("Configuração de distribuição salva.")
        router.refresh()
      })()
    })
  }

  const redistributeNow = async () => {
    if (!canManage || !tableReady) return
    setErrorMsg(null)
    setIsProcessing(true)
    try {
      const result = await redistributeOverdueLeadsNow(50)
      if (!result.success) {
        setErrorMsg(result.error)
        toast.error(result.error)
        return
      }

      toast.success(`Verificados: ${result.data?.checked ?? 0} | Redistribuídos: ${result.data?.reassigned ?? 0}`)
      router.refresh()
    } catch (error) {
      console.error("Error redistributing overdue leads:", error)
      const message = error instanceof Error ? error.message : "Erro ao redistribuir leads atrasados."
      setErrorMsg(message)
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  const resetChanges = () => {
    setEnabled(savedSettings.enabled)
    setSlaMinutes(savedSettings.slaMinutes)
    setRedistributeOverdue(savedSettings.redistributeOverdue)
  }

  return (
    <div className="space-y-6">
      {!tableReady ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Migração pendente: execute a migration de distribuição de leads no Supabase para habilitar esta seção.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium">Distribuição automática de leads</label>
            <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Ativa" : "Desligada"}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
              disabled={!canManage || !tableReady || isBusy}
            />
            <span className="text-sm text-muted-foreground">Distribuição automática entre corretores ativos.</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Modo ativo</label>
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            Rodízio entre corretores
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">SLA de primeiro contato (minutos)</label>
          <Input
            type="number"
            min={1}
            max={1440}
            value={slaMinutes}
            onChange={(e) => setSlaMinutes(e.target.value)}
            onBlur={() => setSlaMinutes(normalizedSlaMinutes)}
            disabled={!canManage || !tableReady || isBusy}
          />
          <p className="text-xs text-muted-foreground">
            Verde/Amarelo/Vermelho no CRM será calculado com base neste SLA.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium">Redistribuir leads atrasados</label>
            <Badge variant={redistributeOverdue ? "default" : "secondary"}>
              {redistributeOverdue ? "Ativa" : "Desligada"}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              checked={redistributeOverdue}
              onChange={(e) => setRedistributeOverdue(e.target.checked)}
              className="h-4 w-4"
              disabled={!canManage || !tableReady || isBusy}
            />
            <span className="text-sm text-muted-foreground">Permite tirar lead parado e passar para outro corretor.</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">Resumo da configuração</p>
          {hasChanges ? <Badge variant="outline">Alterações pendentes</Badge> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant={enabled ? "default" : "secondary"}>
            Distribuição {enabled ? "ativa" : "desligada"}
          </Badge>
          <Badge variant="outline">SLA: {normalizedSlaMinutes} min</Badge>
          <Badge variant={redistributeOverdue ? "default" : "secondary"}>
            Redistribuição {redistributeOverdue ? "ativa" : "desligada"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!canManage || !tableReady || isBusy || !hasChanges}>
          {isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
        {canManage && hasChanges ? (
          <Button variant="outline" onClick={resetChanges} disabled={isBusy}>
            Desfazer alterações
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={redistributeNow}
          disabled={!canManage || !tableReady || isBusy || hasChanges}
        >
          {isProcessing ? "Redistribuindo..." : "Redistribuir atrasados agora"}
        </Button>
      </div>
      {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}

      {!canManage ? (
        <p className="text-xs text-muted-foreground">
          Somente gestores podem alterar estas configurações e executar redistribuição manual.
        </p>
      ) : hasChanges ? (
        <p className="text-xs text-muted-foreground">
          Salve as alterações antes de executar uma redistribuição manual.
        </p>
      ) : !hasChanges ? (
        <p className="text-xs text-muted-foreground">Nenhuma alteração pendente para salvar.</p>
      ) : null}
    </div>
  )
}
