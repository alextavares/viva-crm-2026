"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  loadWhatsAppAddonUsage,
  saveWhatsAppAddonPricing,
} from "@/app/actions/whatsapp"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { WhatsAppAddonUsageSnapshot } from "@/lib/types"
import { displayEmptyForZero } from "@/lib/utils"

type AddonSettings = {
  organization_id: string
  addon_enabled: boolean
  included_quota: number
  overage_price: number
  currency_code: string
  billing_timezone: string
}

type Props = {
  canManage: boolean
  tableReady: boolean
  usageReady: boolean
  initial: AddonSettings
  initialUsage: WhatsAppAddonUsageSnapshot | null
}

function toInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

function toDecimal(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const clamped = Math.min(max, Math.max(min, parsed))
  return Number(clamped.toFixed(4))
}

function parseDecimalInput(value: string, fallback: number) {
  const normalized = value.replace(",", ".").trim()
  if (!normalized) return fallback
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function toCurrencyLabel(value: number, currencyCode: string) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currencyCode || "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value)
  } catch {
    return value.toFixed(2)
  }
}

function normalizeUsage(snapshot: WhatsAppAddonUsageSnapshot | null): WhatsAppAddonUsageSnapshot | null {
  if (!snapshot) return null
  return {
    organization_id: snapshot.organization_id ?? null,
    addon_enabled: Boolean(snapshot.addon_enabled),
    timezone: snapshot.timezone || "America/Sao_Paulo",
    period_start: snapshot.period_start || null,
    period_end: snapshot.period_end || null,
    included_quota: Number(snapshot.included_quota) || 0,
    consumed: Number(snapshot.consumed) || 0,
    balance: Number(snapshot.balance) || 0,
    usage_percent: Number(snapshot.usage_percent) || 0,
    alert_level: snapshot.alert_level || "ok",
  }
}

function toPeriodLabel(periodStart: string | null, periodEnd: string | null) {
  if (!periodStart || !periodEnd) return "Período atual"
  try {
    const start = new Date(`${periodStart}T00:00:00`)
    const end = new Date(`${periodEnd}T00:00:00`)
    const startLabel = start.toLocaleDateString("pt-BR")
    const endLabel = end.toLocaleDateString("pt-BR")
    return `${startLabel} até ${endLabel}`
  } catch {
    return `${periodStart} até ${periodEnd}`
  }
}

export function WhatsAppAddonPricingForm({ canManage, tableReady, usageReady, initial, initialUsage }: Props) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshingUsage, setIsRefreshingUsage] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [addonEnabled, setAddonEnabled] = useState(Boolean(initial.addon_enabled))
  const [includedQuota, setIncludedQuota] = useState(toInt(initial.included_quota, 0, 0, 1000000))
  const [overagePriceInput, setOveragePriceInput] = useState(
    initial.overage_price > 0 ? String(initial.overage_price) : ""
  )
  const [currencyCode, setCurrencyCode] = useState((initial.currency_code || "BRL").toUpperCase())
  const [billingTimezone, setBillingTimezone] = useState(initial.billing_timezone || "America/Sao_Paulo")
  const [usage, setUsage] = useState<WhatsAppAddonUsageSnapshot | null>(normalizeUsage(initialUsage))

  const statusLabel = addonEnabled ? "Ativo" : "Inativo"
  const statusClass = addonEnabled
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : "border-amber-300 bg-amber-50 text-amber-700"

  const overageLabel = useMemo(
    () => toCurrencyLabel(toDecimal(parseDecimalInput(overagePriceInput, 0), 0, 0, 999999), currencyCode),
    [currencyCode, overagePriceInput]
  )
  const usagePercent = Math.min(100, Math.max(0, Number(usage?.usage_percent || 0)))
  const usageAlert = usage?.alert_level || "ok"
  const usageAlertClass =
    usageAlert === "limit"
      ? "border-rose-300 bg-rose-50 text-rose-700"
      : usageAlert === "warning"
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : usageAlert === "disabled"
          ? "border-slate-300 bg-slate-50 text-slate-700"
          : "border-emerald-300 bg-emerald-50 text-emerald-700"
  const usageAlertLabel =
    usageAlert === "limit"
      ? "Quota atingida"
      : usageAlert === "warning"
        ? "Alerta de quota (80%+)"
        : usageAlert === "disabled"
          ? "Add-on inativo"
          : "Consumo normal"

  const refreshUsage = async () => {
    if (!tableReady || !usageReady || isRefreshingUsage) return
    setIsRefreshingUsage(true)
    setErrorMsg(null)
    try {
      const result = await loadWhatsAppAddonUsage()
      if (!result.success) {
        throw new Error(result.error || "Erro ao atualizar consumo.")
      }
      setUsage(normalizeUsage(result.data.usage ?? null))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o consumo agora."
      setErrorMsg(message)
      toast.error(message)
    } finally {
      setIsRefreshingUsage(false)
    }
  }

  const save = async () => {
    if (!canManage || !tableReady || isSaving) return

    setIsSaving(true)
    setErrorMsg(null)

    try {
      const safeQuota = Number.isFinite(Number(includedQuota)) ? Math.trunc(Number(includedQuota)) : 0
      const safeOverage = toDecimal(parseDecimalInput(overagePriceInput, 0), 0, 0, 999999)
      const safeCurrency = (currencyCode || "BRL").trim().toUpperCase()
      const safeTimezone = (billingTimezone || "America/Sao_Paulo").trim()

      const result = await saveWhatsAppAddonPricing({
        addon_enabled: addonEnabled,
        included_quota: safeQuota,
        overage_price: safeOverage,
        currency_code: safeCurrency,
        billing_timezone: safeTimezone,
      })

      if (!result.success) {
        throw new Error(result.error || "Erro ao salvar add-on WhatsApp.")
      }

      setIncludedQuota(safeQuota)
      setOveragePriceInput(safeOverage > 0 ? String(safeOverage) : "")
      setCurrencyCode(safeCurrency)
      setBillingTimezone(safeTimezone)
      await refreshUsage()
      toast.success("Configuração de pricing do add-on salva.")
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar add-on WhatsApp."
      setErrorMsg(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {!tableReady ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Migração pendente: execute a migration de pricing do add-on WhatsApp no Supabase para habilitar esta seção.
        </div>
      ) : null}

      {!usageReady ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Migração pendente: execute a migration de consumo do add-on WhatsApp para habilitar o painel de uso.
        </div>
      ) : null}

      {errorMsg ? (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">{errorMsg}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Status do add-on</div>
          <div className={`mt-2 inline-flex rounded-md border px-2 py-1 text-sm font-medium ${statusClass}`}>
            {statusLabel}
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Quota inclusa</div>
          <div className="mt-2 text-2xl font-semibold">{includedQuota}</div>
          <p className="text-xs text-muted-foreground">mensagens/mês incluídas</p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Consumido no mês</div>
          <div className="mt-2 text-2xl font-semibold">{usage?.consumed ?? 0}</div>
          <p className="text-xs text-muted-foreground">mensagens contabilizadas</p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Saldo da quota</div>
          <div className="mt-2 text-2xl font-semibold">{usage?.balance ?? 0}</div>
          <p className="text-xs text-muted-foreground">mensagens restantes no período</p>
        </div>

        <div className="rounded-lg border p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Excedente</div>
          <div className="mt-2 text-2xl font-semibold">{overageLabel}</div>
          <p className="text-xs text-muted-foreground">por mensagem acima da quota</p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Consumo do período</div>
            <p className="text-xs text-muted-foreground">
              {toPeriodLabel(usage?.period_start ?? null, usage?.period_end ?? null)} • TZ{" "}
              {usage?.timezone || billingTimezone || "America/Sao_Paulo"}
            </p>
          </div>
          <div className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${usageAlertClass}`}>
            {usageAlertLabel}
          </div>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              usageAlert === "limit" ? "bg-rose-500" : usageAlert === "warning" ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${usagePercent}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{usagePercent.toFixed(2)}% usado</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshUsage}
            disabled={!usageReady || isRefreshingUsage}
          >
            {isRefreshingUsage ? "Atualizando..." : "Atualizar consumo"}
          </Button>
        </div>

        {usageAlert === "warning" ? (
          <p className="mt-3 text-sm text-amber-700">
            Atenção: o consumo atingiu 80% da quota. Avalie aumento de pacote para evitar bloqueios.
          </p>
        ) : null}

        {usageAlert === "limit" ? (
          <p className="mt-3 text-sm text-rose-700">
            Quota mensal atingida. Novos envios podem ser cobrados como excedente.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Ativar add-on WhatsApp</label>
          <div className="flex items-center gap-2">
            <Input
              type="checkbox"
              checked={addonEnabled}
              onChange={(e) => {
                setErrorMsg(null)
                setAddonEnabled(e.target.checked)
              }}
              className="h-4 w-4"
              disabled={!canManage || !tableReady || isSaving}
            />
            <span className="text-sm text-muted-foreground">
              Quando desativado, o CRM base continua normal sem custo extra de add-on.
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Quota mensal incluída</label>
          <Input
            type="number"
            min={0}
            max={1000000}
            value={displayEmptyForZero(includedQuota)}
            onChange={(e) => {
              setErrorMsg(null)
              setIncludedQuota(toInt(e.target.value, 0, 0, 1000000))
            }}
            disabled={!canManage || !tableReady || isSaving}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Preço por excedente</label>
          <Input
            type="text"
            inputMode="decimal"
            value={overagePriceInput}
            onChange={(e) => {
              setErrorMsg(null)
              setOveragePriceInput(e.target.value)
            }}
            disabled={!canManage || !tableReady || isSaving}
            placeholder="0,05"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Moeda</label>
          <Input
            value={currencyCode}
            onChange={(e) => {
              setErrorMsg(null)
              setCurrencyCode(e.target.value.toUpperCase().slice(0, 3))
            }}
            maxLength={3}
            disabled={!canManage || !tableReady || isSaving}
          />
          <p className="text-xs text-muted-foreground">Formato ISO 4217 (ex.: BRL, USD).</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Timezone de faturamento</label>
          <Input
            value={billingTimezone}
            onChange={(e) => {
              setErrorMsg(null)
              setBillingTimezone(e.target.value)
            }}
            disabled={!canManage || !tableReady || isSaving}
            placeholder="America/Sao_Paulo"
          />
          <p className="text-xs text-muted-foreground">
            Define o fechamento mensal da quota (ex.: America/Sao_Paulo, UTC).
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="button" onClick={save} disabled={!canManage || !tableReady || isSaving}>
          {isSaving ? "Salvando..." : "Salvar pricing do add-on"}
        </Button>
      </div>
    </div>
  )
}
