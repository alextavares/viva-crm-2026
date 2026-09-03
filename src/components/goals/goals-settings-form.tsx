"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { saveGoalBrokerOverrides, saveGoalSettings } from "@/app/actions/goals"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { displayEmptyForZero } from "@/lib/utils"

type GoalSettings = {
  organization_id: string
  enabled: boolean
  period_type: "weekly" | "monthly"
  metric_captacoes_enabled: boolean
  metric_respostas_enabled: boolean
  metric_visitas_enabled: boolean
  response_sla_minutes: number
  target_captacoes: number
  target_respostas: number
  target_visitas: number
}

export type BrokerOverrideDraft = {
  profile_id: string
  name: string | null
  email: string | null
  enabled: boolean
  period_type: "weekly" | "monthly" | null
  metric_captacoes_enabled: boolean | null
  metric_respostas_enabled: boolean | null
  metric_visitas_enabled: boolean | null
  response_sla_minutes: number | null
  target_captacoes: number | null
  target_respostas: number | null
  target_visitas: number | null
}

type BrokerFormRow = {
  profile_id: string
  name: string | null
  email: string | null
  enabled: boolean
  period_type: "weekly" | "monthly" | ""
  metric_captacoes_enabled: "global" | "on" | "off"
  metric_respostas_enabled: "global" | "on" | "off"
  metric_visitas_enabled: "global" | "on" | "off"
  response_sla_minutes: string
  target_captacoes: string
  target_respostas: string
  target_visitas: string
}

type Props = {
  canManage: boolean
  tableReady: boolean
  initial: GoalSettings
  initialOverrides: BrokerOverrideDraft[]
}

function toOptionalInt(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  return String(Math.trunc(parsed))
}

function toInitialNumberInput(value: number, options?: { emptyWhenZero?: boolean }) {
  if (options?.emptyWhenZero && value === 0) {
    return ""
  }

  return String(value)
}

function overrideBoolToForm(v: boolean | null | undefined): "global" | "on" | "off" {
  if (v === true) return "on"
  if (v === false) return "off"
  return "global"
}

function formBoolToOverride(v: "global" | "on" | "off"): boolean | null {
  if (v === "on") return true
  if (v === "off") return false
  return null
}

export function GoalsSettingsForm({ canManage, tableReady, initial, initialOverrides }: Props) {
  const router = useRouter()
  const [isSavingGlobal, setIsSavingGlobal] = useState(false)
  const [isSavingOverrides, setIsSavingOverrides] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [enabled, setEnabled] = useState(Boolean(initial.enabled))
  const [periodType, setPeriodType] = useState<"weekly" | "monthly">(
    initial.period_type === "monthly" ? "monthly" : "weekly"
  )
  const [metricCaptacoesEnabled, setMetricCaptacoesEnabled] = useState(Boolean(initial.metric_captacoes_enabled))
  const [metricRespostasEnabled, setMetricRespostasEnabled] = useState(Boolean(initial.metric_respostas_enabled))
  const [metricVisitasEnabled, setMetricVisitasEnabled] = useState(Boolean(initial.metric_visitas_enabled))
  const [responseSlaMinutes, setResponseSlaMinutes] = useState(toInitialNumberInput(initial.response_sla_minutes))
  const [targetCaptacoes, setTargetCaptacoes] = useState(
    toInitialNumberInput(initial.target_captacoes, { emptyWhenZero: true })
  )
  const [targetRespostas, setTargetRespostas] = useState(
    toInitialNumberInput(initial.target_respostas, { emptyWhenZero: true })
  )
  const [targetVisitas, setTargetVisitas] = useState(
    toInitialNumberInput(initial.target_visitas, { emptyWhenZero: true })
  )

  const [rows, setRows] = useState<BrokerFormRow[]>(
    initialOverrides.map((row) => ({
      profile_id: row.profile_id,
      name: row.name,
      email: row.email,
      enabled: row.enabled,
      period_type: row.period_type ?? "",
      metric_captacoes_enabled: overrideBoolToForm(row.metric_captacoes_enabled),
      metric_respostas_enabled: overrideBoolToForm(row.metric_respostas_enabled),
      metric_visitas_enabled: overrideBoolToForm(row.metric_visitas_enabled),
      response_sla_minutes: row.response_sla_minutes == null ? "" : String(row.response_sla_minutes),
      target_captacoes: row.target_captacoes == null ? "" : String(row.target_captacoes),
      target_respostas: row.target_respostas == null ? "" : String(row.target_respostas),
      target_visitas: row.target_visitas == null ? "" : String(row.target_visitas),
    }))
  )

  const enabledBrokersCount = useMemo(() => rows.filter((r) => r.enabled).length, [rows])
  const isSavingAny = isSavingGlobal || isSavingOverrides

  const setRow = (profileId: string, patch: Partial<BrokerFormRow>) => {
    setErrorMsg(null)
    setRows((prev) => prev.map((row) => (row.profile_id === profileId ? { ...row, ...patch } : row)))
  }

  const buildOverridePayload = () =>
    rows
      .map((row) => {
        const period = row.period_type === "weekly" || row.period_type === "monthly" ? row.period_type : null
        const override = {
          profile_id: row.profile_id,
          enabled: row.enabled,
          period_type: period,
          metric_captacoes_enabled: formBoolToOverride(row.metric_captacoes_enabled),
          metric_respostas_enabled: formBoolToOverride(row.metric_respostas_enabled),
          metric_visitas_enabled: formBoolToOverride(row.metric_visitas_enabled),
          response_sla_minutes: toOptionalInt(row.response_sla_minutes),
          target_captacoes: toOptionalInt(row.target_captacoes),
          target_respostas: toOptionalInt(row.target_respostas),
          target_visitas: toOptionalInt(row.target_visitas),
          updated_at: new Date().toISOString(),
        }

        const hasAnyExplicitOverride =
          override.enabled === false ||
          override.period_type !== null ||
          override.metric_captacoes_enabled !== null ||
          override.metric_respostas_enabled !== null ||
          override.metric_visitas_enabled !== null ||
          override.response_sla_minutes !== null ||
          override.target_captacoes !== null ||
          override.target_respostas !== null ||
          override.target_visitas !== null

        return hasAnyExplicitOverride ? override : null
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

  const saveGlobal = async () => {
    if (!canManage || !tableReady || isSavingAny) return

    setIsSavingGlobal(true)
    setErrorMsg(null)

    try {
      const result = await saveGoalSettings({
        enabled,
        period_type: periodType,
        metric_captacoes_enabled: metricCaptacoesEnabled,
        metric_respostas_enabled: metricRespostasEnabled,
        metric_visitas_enabled: metricVisitasEnabled,
        response_sla_minutes: responseSlaMinutes,
        target_captacoes: targetCaptacoes,
        target_respostas: targetRespostas,
        target_visitas: targetVisitas,
      })

      if (!result.success) {
        throw new Error(result.error || "Erro ao salvar metas.")
      }

      const normalizedSla = Math.trunc(Number(responseSlaMinutes))
      const normalizedTargetCaptacoes = Math.trunc(Number(targetCaptacoes || "0"))
      const normalizedTargetRespostas = Math.trunc(Number(targetRespostas || "0"))
      const normalizedTargetVisitas = Math.trunc(Number(targetVisitas || "0"))

      setResponseSlaMinutes(String(normalizedSla))
      setTargetCaptacoes(normalizedTargetCaptacoes === 0 ? "" : String(normalizedTargetCaptacoes))
      setTargetRespostas(normalizedTargetRespostas === 0 ? "" : String(normalizedTargetRespostas))
      setTargetVisitas(normalizedTargetVisitas === 0 ? "" : String(normalizedTargetVisitas))

      toast.success("Configurações globais salvas.")
      router.refresh()
    } catch (error) {
      console.warn("Error saving goals settings:", error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Erro ao salvar configurações globais."
      setErrorMsg(message)
      toast.error(message)
    } finally {
      setIsSavingGlobal(false)
    }
  }

  const saveOverrides = async () => {
    if (!canManage || !tableReady || isSavingAny) return

    setIsSavingOverrides(true)
    setErrorMsg(null)

    try {
      const overridePayload = buildOverridePayload()

      const result = await saveGoalBrokerOverrides({
        overrides: overridePayload,
      })

      if (!result.success) {
        throw new Error(result.error || "Erro ao salvar exceções por corretor.")
      }

      toast.success("Exceções por corretor salvas.")
      router.refresh()
    } catch (error) {
      console.warn("Error saving goals overrides:", error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Erro ao salvar exceções por corretor."
      setErrorMsg(message)
      toast.error(message)
    } finally {
      setIsSavingOverrides(false)
    }
  }

  return (
    <div className="space-y-6">
      {errorMsg ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {!tableReady ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Migração pendente: execute a migration de metas no Supabase para habilitar esta seção.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Ativar metas no dashboard</label>
          <div className="flex items-center gap-2">
              <Input
                type="checkbox"
                checked={enabled}
                onChange={(e) => {
                  setErrorMsg(null)
                  setEnabled(e.target.checked)
                }}
                className="h-4 w-4"
                disabled={!canManage || !tableReady || isSavingAny}
              />
            <span className="text-sm text-muted-foreground">Exibe metas no dashboard do corretor.</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Período padrão</label>
          <select
            value={periodType}
            onChange={(e) => {
              setErrorMsg(null)
              setPeriodType(e.target.value === "monthly" ? "monthly" : "weekly")
            }}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm"
            disabled={!canManage || !tableReady || isSavingAny}
          >
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Métricas ativas (global)</label>
          <div className="space-y-2 rounded-md border p-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Input
                type="checkbox"
                checked={metricCaptacoesEnabled}
                onChange={(e) => {
                  setErrorMsg(null)
                  setMetricCaptacoesEnabled(e.target.checked)
                }}
                className="h-4 w-4"
                disabled={!canManage || !tableReady || isSavingAny}
              />
              Meta de captações
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Input
                type="checkbox"
                checked={metricRespostasEnabled}
                onChange={(e) => {
                  setErrorMsg(null)
                  setMetricRespostasEnabled(e.target.checked)
                }}
                className="h-4 w-4"
                disabled={!canManage || !tableReady || isSavingAny}
              />
              Meta de respostas rápidas
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Input
                type="checkbox"
                checked={metricVisitasEnabled}
                onChange={(e) => {
                  setErrorMsg(null)
                  setMetricVisitasEnabled(e.target.checked)
                }}
                className="h-4 w-4"
                disabled={!canManage || !tableReady || isSavingAny}
              />
              Meta de visitas agendadas
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Meta de captações</label>
          <Input
            type="number"
            min={0}
            max={100000}
            value={displayEmptyForZero(targetCaptacoes)}
            onChange={(e) => {
              setErrorMsg(null)
              setTargetCaptacoes(e.target.value)
            }}
            disabled={!canManage || !tableReady || isSavingAny}
          />
          <p className="text-xs text-muted-foreground">Captação = imóvel criado no período.</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Meta de respostas rápidas</label>
          <Input
            type="number"
            min={0}
            max={100000}
            value={displayEmptyForZero(targetRespostas)}
            onChange={(e) => {
              setErrorMsg(null)
              setTargetRespostas(e.target.value)
            }}
            disabled={!canManage || !tableReady || isSavingAny}
          />
          <p className="text-xs text-muted-foreground">Conta 1ª mensagem de saída ou 1ª troca de status do lead.</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Meta de visitas agendadas</label>
          <Input
            type="number"
            min={0}
            max={100000}
            value={displayEmptyForZero(targetVisitas)}
            onChange={(e) => {
              setErrorMsg(null)
              setTargetVisitas(e.target.value)
            }}
            disabled={!canManage || !tableReady || isSavingAny}
          />
          <p className="text-xs text-muted-foreground">Conta agendamentos da carteira no período.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">SLA de resposta rápida (min)</label>
          <Input
            type="number"
            min={1}
            max={1440}
            value={displayEmptyForZero(responseSlaMinutes)}
            onChange={(e) => {
              setErrorMsg(null)
              setResponseSlaMinutes(e.target.value)
            }}
            disabled={!canManage || !tableReady || isSavingAny}
          />
          <p className="text-xs text-muted-foreground">Usado para calcular “resposta rápida”.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={saveGlobal} disabled={!canManage || !tableReady || isSavingAny}>
          {isSavingGlobal ? "Salvando global..." : "Salvar global"}
        </Button>
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Exceções por corretor</h2>
            <p className="text-xs text-muted-foreground">
              Corretores ativos para metas: {enabledBrokersCount}/{rows.length}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Campos vazios herdam o valor global.</p>
        </div>

        <div className="space-y-3">
          {rows.length === 0 ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              Nenhum corretor ativo encontrado na organização.
            </div>
          ) : null}

          {rows.map((row) => (
            <div key={row.profile_id} className="rounded-md border p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">{row.name || "Corretor sem nome"}</div>
                  <div className="text-xs text-muted-foreground">{row.email || row.profile_id}</div>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => setRow(row.profile_id, { enabled: e.target.checked })}
                    className="h-4 w-4"
                    disabled={!canManage || !tableReady || isSavingAny}
                  />
                  Ativo para metas
                </label>
              </div>

              <div className="mb-3 grid gap-2 md:grid-cols-3">
                <div>
                  <label className="text-xs text-muted-foreground">Captações (opcional)</label>
                  <select
                    value={row.metric_captacoes_enabled}
                    onChange={(e) =>
                      setRow(row.profile_id, {
                        metric_captacoes_enabled:
                          e.target.value === "on" || e.target.value === "off" ? e.target.value : "global",
                      })
                    }
                    className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
                    disabled={!canManage || !tableReady || isSavingAny}
                  >
                    <option value="global">Global</option>
                    <option value="on">Ativa</option>
                    <option value="off">Desativada</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Respostas (opcional)</label>
                  <select
                    value={row.metric_respostas_enabled}
                    onChange={(e) =>
                      setRow(row.profile_id, {
                        metric_respostas_enabled:
                          e.target.value === "on" || e.target.value === "off" ? e.target.value : "global",
                      })
                    }
                    className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
                    disabled={!canManage || !tableReady || isSavingAny}
                  >
                    <option value="global">Global</option>
                    <option value="on">Ativa</option>
                    <option value="off">Desativada</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Visitas (opcional)</label>
                  <select
                    value={row.metric_visitas_enabled}
                    onChange={(e) =>
                      setRow(row.profile_id, {
                        metric_visitas_enabled:
                          e.target.value === "on" || e.target.value === "off" ? e.target.value : "global",
                      })
                    }
                    className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
                    disabled={!canManage || !tableReady || isSavingAny}
                  >
                    <option value="global">Global</option>
                    <option value="on">Ativa</option>
                    <option value="off">Desativada</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-5">
                <div>
                  <label className="text-xs text-muted-foreground">Período (opcional)</label>
                  <select
                    value={row.period_type}
                    onChange={(e) =>
                      setRow(row.profile_id, {
                        period_type:
                          e.target.value === "weekly" || e.target.value === "monthly"
                            ? (e.target.value as "weekly" | "monthly")
                            : "",
                      })
                    }
                    className="mt-1 w-full rounded-md border bg-white px-2 py-2 text-sm"
                    disabled={!canManage || !tableReady || isSavingAny}
                  >
                    <option value="">Global</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Meta captações (opc.)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100000}
                    value={displayEmptyForZero(row.target_captacoes)}
                    onChange={(e) => setRow(row.profile_id, { target_captacoes: e.target.value })}
                    disabled={!canManage || !tableReady || isSavingAny}
                    placeholder="Global"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Meta respostas (opc.)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100000}
                    value={displayEmptyForZero(row.target_respostas)}
                    onChange={(e) => setRow(row.profile_id, { target_respostas: e.target.value })}
                    disabled={!canManage || !tableReady || isSavingAny}
                    placeholder="Global"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Meta visitas (opc.)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100000}
                    value={displayEmptyForZero(row.target_visitas)}
                    onChange={(e) => setRow(row.profile_id, { target_visitas: e.target.value })}
                    disabled={!canManage || !tableReady || isSavingAny}
                    placeholder="Global"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">SLA min (opcional)</label>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    value={displayEmptyForZero(row.response_sla_minutes)}
                    onChange={(e) => setRow(row.profile_id, { response_sla_minutes: e.target.value })}
                    disabled={!canManage || !tableReady || isSavingAny}
                    placeholder="Global"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={saveOverrides} disabled={!canManage || !tableReady || isSavingAny} variant="outline">
          {isSavingOverrides ? "Salvando exceções..." : "Salvar exceções por corretor"}
        </Button>
      </div>
    </div>
  )
}
