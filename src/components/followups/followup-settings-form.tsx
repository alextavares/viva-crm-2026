"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type SettingsRow = {
  organization_id: string
  enabled: boolean
  step_5m_template: string
  step_24h_template: string
  step_3d_template: string
}

type Props = {
  organizationId: string
  canManage: boolean
  tableReady: boolean
  initial: SettingsRow
}

const DEFAULTS = {
  step5m: "Olá {{first_name}}, vi seu interesse e posso te ajudar agora. Posso te chamar no WhatsApp?",
  step24h: "Oi {{first_name}}, passando para saber se você quer avançar com os imóveis que combinam com seu perfil.",
  step3d: "Olá {{first_name}}, ainda tenho opções boas para você. Quer que eu te envie uma seleção atualizada?",
}

export function FollowupSettingsForm({ organizationId, canManage, tableReady, initial }: Props) {
  const supabase = createClient()
  const [isSaving, setIsSaving] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [enabled, setEnabled] = useState(Boolean(initial.enabled))
  const [step5m, setStep5m] = useState(initial.step_5m_template || DEFAULTS.step5m)
  const [step24h, setStep24h] = useState(initial.step_24h_template || DEFAULTS.step24h)
  const [step3d, setStep3d] = useState(initial.step_3d_template || DEFAULTS.step3d)

  const save = async () => {
    if (!canManage || !tableReady) return
    setIsSaving(true)
    try {
      const { error } = await supabase.from("followup_settings").upsert({
        organization_id: organizationId,
        enabled,
        step_5m_template: step5m.trim(),
        step_24h_template: step24h.trim(),
        step_3d_template: step3d.trim(),
        updated_at: new Date().toISOString(),
      })

      if (error) throw error
      toast.success("Configuração de follow-up salva.")
    } catch (error) {
      console.error("Error saving followup settings:", error)
      toast.error("Erro ao salvar follow-up.")
    } finally {
      setIsSaving(false)
    }
  }

  const processNow = async () => {
    setIsProcessing(true)
    try {
      const res = await fetch("/api/jobs/followups/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.message || "Falha ao processar follow-ups.")
      }

      const result = data?.result || {}
      toast.success(`Processado: ${result.processed ?? 0} | Enviados: ${result.sent ?? 0} | Falhas: ${result.failed ?? 0}`)
    } catch (error) {
      console.error("Error processing followups:", error)
      toast.error("Erro ao processar follow-ups.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {!tableReady ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Migração pendente: execute a migration de follow-up no Supabase para habilitar esta seção.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Ativar follow-up automático</label>
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
              disabled={!canManage || !tableReady}
            />
            <span className="text-sm text-muted-foreground">Dispara sequência 5min / 24h / 3dias em novos leads.</span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Variáveis suportadas</label>
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Use <code>{"{{first_name}}"}</code> e <code>{"{{name}}"}</code> nos templates.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Template 5 minutos</label>
        <Textarea value={step5m} onChange={(e) => setStep5m(e.target.value)} className="min-h-[90px]" disabled={!canManage || !tableReady} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Template 24 horas</label>
        <Textarea value={step24h} onChange={(e) => setStep24h(e.target.value)} className="min-h-[90px]" disabled={!canManage || !tableReady} />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Template 3 dias</label>
        <Textarea value={step3d} onChange={(e) => setStep3d(e.target.value)} className="min-h-[90px]" disabled={!canManage || !tableReady} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!canManage || !tableReady || isSaving}>
          {isSaving ? "Salvando..." : "Salvar configurações"}
        </Button>
        <Button variant="outline" onClick={processNow} disabled={!tableReady || isProcessing}>
          {isProcessing ? "Processando..." : "Processar follow-ups agora"}
        </Button>
      </div>
    </div>
  )
}

