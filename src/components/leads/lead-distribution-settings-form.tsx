"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type SettingsRow = {
  organization_id: string
  enabled: boolean
  mode: "round_robin"
  sla_minutes: number
  redistribute_overdue: boolean
}

type Props = {
  organizationId: string
  canManage: boolean
  tableReady: boolean
  initial: SettingsRow
}

export function LeadDistributionSettingsForm({ organizationId, canManage, tableReady, initial }: Props) {
  const supabase = createClient()
  const [isSaving, setIsSaving] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [enabled, setEnabled] = useState(Boolean(initial.enabled))
  const [slaMinutes, setSlaMinutes] = useState(Math.min(Math.max(initial.sla_minutes || 15, 1), 1440))
  const [redistributeOverdue, setRedistributeOverdue] = useState(Boolean(initial.redistribute_overdue))

  const save = async () => {
    if (!canManage || !tableReady) return
    setIsSaving(true)
    try {
      const safeSla = Math.min(Math.max(Number(slaMinutes) || 15, 1), 1440)

      const { error } = await supabase.from("lead_distribution_settings").upsert({
        organization_id: organizationId,
        enabled,
        mode: "round_robin",
        sla_minutes: safeSla,
        redistribute_overdue: redistributeOverdue,
        updated_at: new Date().toISOString(),
      })

      if (error) throw error
      setSlaMinutes(safeSla)
      toast.success("Configuração de distribuição salva.")
    } catch (error) {
      console.error("Error saving lead distribution settings:", error)
      toast.error("Erro ao salvar distribuição de leads.")
    } finally {
      setIsSaving(false)
    }
  }

  const redistributeNow = async () => {
    setIsProcessing(true)
    try {
      const res = await fetch("/api/jobs/leads/redistribute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message || "Falha ao redistribuir.")

      const result = data?.result || {}
      toast.success(`Verificados: ${result.checked ?? 0} | Redistribuídos: ${result.reassigned ?? 0}`)
    } catch (error) {
      console.error("Error redistributing overdue leads:", error)
      toast.error("Erro ao redistribuir leads atrasados.")
    } finally {
      setIsProcessing(false)
    }
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
          <label className="text-sm font-medium">Distribuição automática de leads</label>
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
              disabled={!canManage || !tableReady}
            />
            <span className="text-sm text-muted-foreground">Round-robin automático para corretores (broker).</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Modo ativo</label>
          <Input value="Round-robin (somente broker)" readOnly className="text-sm text-muted-foreground" />
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
            onChange={(e) => setSlaMinutes(Number(e.target.value))}
            disabled={!canManage || !tableReady}
          />
          <p className="text-xs text-muted-foreground">
            Verde/Amarelo/Vermelho no CRM será calculado com base neste SLA.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Redistribuir leads atrasados</label>
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              checked={redistributeOverdue}
              onChange={(e) => setRedistributeOverdue(e.target.checked)}
              className="h-4 w-4"
              disabled={!canManage || !tableReady}
            />
            <span className="text-sm text-muted-foreground">Permite tirar lead parado e passar para outro broker.</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!canManage || !tableReady || isSaving}>
          {isSaving ? "Salvando..." : "Salvar configurações"}
        </Button>
        <Button variant="outline" onClick={redistributeNow} disabled={!tableReady || isProcessing}>
          {isProcessing ? "Redistribuindo..." : "Redistribuir atrasados agora"}
        </Button>
      </div>
    </div>
  )
}
