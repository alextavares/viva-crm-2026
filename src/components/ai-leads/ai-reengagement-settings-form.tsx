"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { processAiReengagementsNow, saveAiReengagementSettings } from "@/app/actions/ai-leads"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type SettingsRow = {
  organization_id: string
  enabled: boolean
  first_delay_minutes: number
  second_delay_minutes: number
  third_delay_minutes: number
  inactive_message_template: string
  handoff_message_template: string
  sla_minutes: number
  final_escalation_delay_minutes: number
  notify_broker: boolean
  notify_manager: boolean
}

type Props = {
  canManage: boolean
  tableReady: boolean
  initial: SettingsRow
}

const DEFAULT_INACTIVE_TEMPLATE =
  "Olá {{first_name}}, seguimos por aqui para te ajudar com sua busca. Se quiser, posso retomar seu atendimento agora."
const DEFAULT_HANDOFF_TEMPLATE =
  "Olá {{first_name}}, seu atendimento segue em andamento por aqui. Se quiser continuar agora, me responda nesta conversa."

function clampInt(value: string, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

export function AiReengagementSettingsForm({ canManage, tableReady, initial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(Boolean(initial.enabled))
  const [firstDelay, setFirstDelay] = useState(String(initial.first_delay_minutes))
  const [secondDelay, setSecondDelay] = useState(String(initial.second_delay_minutes))
  const [thirdDelay, setThirdDelay] = useState(String(initial.third_delay_minutes))
  const [slaMinutes, setSlaMinutes] = useState(String(initial.sla_minutes))
  const [finalEscalationDelay, setFinalEscalationDelay] = useState(
    String(initial.final_escalation_delay_minutes)
  )
  const [inactiveMessageTemplate, setInactiveMessageTemplate] = useState(
    initial.inactive_message_template || DEFAULT_INACTIVE_TEMPLATE
  )
  const [handoffMessageTemplate, setHandoffMessageTemplate] = useState(
    initial.handoff_message_template || DEFAULT_HANDOFF_TEMPLATE
  )
  const [notifyBroker, setNotifyBroker] = useState(Boolean(initial.notify_broker))
  const [notifyManager, setNotifyManager] = useState(Boolean(initial.notify_manager))

  const save = async () => {
    if (!canManage || !tableReady) return
    setErrorMsg(null)
    startTransition(() => {
      void (async () => {
        const result = await saveAiReengagementSettings({
          enabled,
          firstDelayMinutes: clampInt(firstDelay, 15, 1, 10080),
          secondDelayMinutes: clampInt(secondDelay, 120, 1, 10080),
          thirdDelayMinutes: clampInt(thirdDelay, 1440, 1, 10080),
          slaMinutes: clampInt(slaMinutes, 30, 1, 10080),
          finalEscalationDelayMinutes: clampInt(finalEscalationDelay, 30, 1, 10080),
          inactiveMessageTemplate: inactiveMessageTemplate.trim() || DEFAULT_INACTIVE_TEMPLATE,
          handoffMessageTemplate: handoffMessageTemplate.trim() || DEFAULT_HANDOFF_TEMPLATE,
          notifyBroker,
          notifyManager,
        })

        if (!result.success) {
          setErrorMsg(result.error)
          toast.error(result.error)
          return
        }

        toast.success("Cadência de retomada IA salva.")
        router.refresh()
      })()
    })
  }

  const processNow = async () => {
    if (!canManage || !tableReady) return
    setErrorMsg(null)
    setIsProcessing(true)

    try {
      const result = await processAiReengagementsNow(100)
      if (!result.success) {
        setErrorMsg(result.error)
        toast.error(result.error)
        return
      }

      const data = result.data
      toast.success(
        `Checados: ${data?.checked ?? 0} | Iniciados: ${data?.started ?? 0} | Tentativas: ${data?.attempted ?? 0} | Parados: ${data?.stopped ?? 0} | Escalados: ${data?.escalated ?? 0}`
      )
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao processar a cadência de retomada IA."
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
          Migração pendente: execute a migration da cadência de retomada IA no Supabase para habilitar esta seção.
        </div>
      ) : null}

      {errorMsg ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">{errorMsg}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Ativar retomada automática da IA</label>
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
              disabled={!canManage || !tableReady || isPending || isProcessing}
            />
            <span className="text-sm text-muted-foreground">
              Dispara até 3 tentativas no WhatsApp quando o lead some ou quando o handoff fica parado.
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Variáveis suportadas</label>
          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            Use <code>{"{{first_name}}"}</code> e <code>{"{{name}}"}</code> na mensagem base.
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">1a tentativa (min)</label>
          <Input
            type="number"
            min={1}
            max={10080}
            value={firstDelay}
            onChange={(e) => setFirstDelay(e.target.value)}
            disabled={!canManage || !tableReady || isPending || isProcessing}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">2a tentativa (min)</label>
          <Input
            type="number"
            min={1}
            max={10080}
            value={secondDelay}
            onChange={(e) => setSecondDelay(e.target.value)}
            disabled={!canManage || !tableReady || isPending || isProcessing}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">3a tentativa (min)</label>
          <Input
            type="number"
            min={1}
            max={10080}
            value={thirdDelay}
            onChange={(e) => setThirdDelay(e.target.value)}
            disabled={!canManage || !tableReady || isPending || isProcessing}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">SLA de ação humana (min)</label>
          <Input
            type="number"
            min={1}
            max={10080}
            value={slaMinutes}
            onChange={(e) => setSlaMinutes(e.target.value)}
            disabled={!canManage || !tableReady || isPending || isProcessing}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Escalonar após 3a (min)</label>
          <Input
            type="number"
            min={1}
            max={10080}
            value={finalEscalationDelay}
            onChange={(e) => setFinalEscalationDelay(e.target.value)}
            disabled={!canManage || !tableReady || isPending || isProcessing}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Mensagem para lead inativo</label>
        <Textarea
          value={inactiveMessageTemplate}
          onChange={(e) => setInactiveMessageTemplate(e.target.value)}
          className="min-h-[110px]"
          disabled={!canManage || !tableReady || isPending || isProcessing}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Mensagem para handoff atrasado</label>
        <Textarea
          value={handoffMessageTemplate}
          onChange={(e) => setHandoffMessageTemplate(e.target.value)}
          className="min-h-[110px]"
          disabled={!canManage || !tableReady || isPending || isProcessing}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Alertar corretor</label>
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              checked={notifyBroker}
              onChange={(e) => setNotifyBroker(e.target.checked)}
              className="h-4 w-4"
              disabled={!canManage || !tableReady || isPending || isProcessing}
            />
            <span className="text-sm text-muted-foreground">
              Quando a cadência esgotar, notifica o corretor responsável/handoff.
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Alertar gestores</label>
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              checked={notifyManager}
              onChange={(e) => setNotifyManager(e.target.checked)}
              className="h-4 w-4"
              disabled={!canManage || !tableReady || isPending || isProcessing}
            />
            <span className="text-sm text-muted-foreground">
              Mantém gestores visíveis quando a retomada automática não destrava o lead.
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={!canManage || !tableReady || isPending || isProcessing}>
          {isPending ? "Salvando..." : "Salvar cadência"}
        </Button>
        <Button
          variant="outline"
          onClick={processNow}
          disabled={!canManage || !tableReady || isProcessing || isPending}
        >
          {isProcessing ? "Processando..." : "Processar retomadas agora"}
        </Button>
      </div>
    </div>
  )
}
