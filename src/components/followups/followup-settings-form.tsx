"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { saveFollowupSettings } from "@/app/actions/settings"
import { processFollowupsNow } from "@/app/actions/followups"

type SettingsRow = {
  organization_id: string
  enabled: boolean
  step_5m_template: string
  step_24h_template: string
  step_3d_template: string
}

type Props = {
  canManage: boolean
  tableReady: boolean
  initial: SettingsRow
}

const DEFAULTS = {
  step5m: "Olá {{first_name}}, vi seu interesse e posso te ajudar agora. Posso te chamar no WhatsApp?",
  step24h: "Oi {{first_name}}, passando para saber se você quer avançar com os imóveis que combinam com seu perfil.",
  step3d: "Olá {{first_name}}, ainda tenho opções boas para você. Quer que eu te envie uma seleção atualizada?",
}

export function FollowupSettingsForm({ canManage, tableReady, initial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const isBusy = isPending || isProcessing
  const [enabled, setEnabled] = useState(Boolean(initial.enabled))
  const [step5m, setStep5m] = useState(initial.step_5m_template || DEFAULTS.step5m)
  const [step24h, setStep24h] = useState(initial.step_24h_template || DEFAULTS.step24h)
  const [step3d, setStep3d] = useState(initial.step_3d_template || DEFAULTS.step3d)

  const save = async () => {
    if (!canManage || !tableReady) return
    setErrorMsg(null)
    startTransition(() => {
      void (async () => {
        const result = await saveFollowupSettings({
          enabled,
          step5m: step5m.trim(),
          step24h: step24h.trim(),
          step3d: step3d.trim(),
        })

        if (!result.success) {
          setErrorMsg(result.error)
          toast.error(result.error)
          return
        }

        toast.success("Configuração de follow-up salva.")
        router.refresh()
      })()
    })
  }

  const processNow = async () => {
    if (!canManage || !tableReady) return
    setErrorMsg(null)
    setIsProcessing(true)
    try {
      const result = await processFollowupsNow(50)
      if (!result.success) {
        setErrorMsg(result.error)
        toast.error(result.error)
        return
      }

      const processed = Number(result.data?.processed ?? 0)
      const sent = Number(result.data?.sent ?? 0)
      const failed = Number(result.data?.failed ?? 0)
      const blocked = Number(result.data?.blocked ?? 0)
      const officialSent = Number(result.data?.official_sent ?? 0)

      toast.success(
        `Processado: ${processed} | Enviados: ${sent} | Oficiais: ${officialSent} | Bloqueados (política): ${blocked} | Falhas: ${failed}`
      )
      router.refresh()
    } catch (error) {
      console.error("Error processing followups:", error)
      const message = error instanceof Error ? error.message : "Erro ao processar follow-ups."
      setErrorMsg(message)
      toast.error(message)
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
              disabled={!canManage || !tableReady || isBusy}
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
        <Textarea
          value={step5m}
          onChange={(e) => setStep5m(e.target.value)}
          className="min-h-[90px]"
          disabled={!canManage || !tableReady || isBusy}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Template 24 horas</label>
        <Textarea
          value={step24h}
          onChange={(e) => setStep24h(e.target.value)}
          className="min-h-[90px]"
          disabled={!canManage || !tableReady || isBusy}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Template 3 dias</label>
        <Textarea
          value={step3d}
          onChange={(e) => setStep3d(e.target.value)}
          className="min-h-[90px]"
          disabled={!canManage || !tableReady || isBusy}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!canManage || !tableReady || isPending}>
          {isPending ? "Salvando..." : "Salvar configurações"}
        </Button>
        <Button variant="outline" onClick={processNow} disabled={!tableReady || isProcessing || isPending}>
          {isProcessing ? "Processando..." : "Processar follow-ups agora"}
        </Button>
      </div>
      {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}
    </div>
  )
}
