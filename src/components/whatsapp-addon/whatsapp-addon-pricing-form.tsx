"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { WhatsAppAddonUsageSnapshot } from "@/lib/types"

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

const SAVE_TIMEOUT_MS = 45_000
const SAVE_WATCHDOG_MS = 60_000
const USAGE_TIMEOUT_MS = 20_000

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
  const [isSaving, setIsSaving] = useState(false)
  const [isRefreshingUsage, setIsRefreshingUsage] = useState(false)
  const [addonEnabled, setAddonEnabled] = useState(Boolean(initial.addon_enabled))
  const [includedQuota, setIncludedQuota] = useState(toInt(initial.included_quota, 0, 0, 1000000))
  const [overagePrice, setOveragePrice] = useState(toDecimal(initial.overage_price, 0, 0, 999999))
  const [currencyCode, setCurrencyCode] = useState((initial.currency_code || "BRL").toUpperCase())
  const [billingTimezone, setBillingTimezone] = useState(initial.billing_timezone || "America/Sao_Paulo")
  const [usage, setUsage] = useState<WhatsAppAddonUsageSnapshot | null>(normalizeUsage(initialUsage))

  const statusLabel = addonEnabled ? "Ativo" : "Inativo"
  const statusClass = addonEnabled
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : "border-amber-300 bg-amber-50 text-amber-700"

  const overageLabel = useMemo(
    () => toCurrencyLabel(toDecimal(overagePrice, 0, 0, 999999), currencyCode),
    [currencyCode, overagePrice]
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

  async function withTimeout<T>(promise: Promise<T>, ms = SAVE_TIMEOUT_MS): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error("RequestTimeout")
        err.name = "TimeoutError"
        reject(err)
      }, ms)
    })

    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  const refreshUsage = async () => {
    if (!tableReady || !usageReady || isRefreshingUsage) return
    setIsRefreshingUsage(true)
    try {
      const response = await withTimeout(fetch("/api/settings/whatsapp-addon/usage", { cache: "no-store" }), USAGE_TIMEOUT_MS)
      if (!response.ok) {
        let msg = "Erro ao atualizar consumo."
        try {
          const data = (await response.json()) as { message?: string }
          if (data?.message) msg = data.message
        } catch {
          // keep fallback message
        }
        throw new Error(msg)
      }
      const data = (await response.json()) as { usage?: WhatsAppAddonUsageSnapshot | null }
      setUsage(normalizeUsage(data.usage ?? null))
    } catch (error) {
      console.warn("Error refreshing whatsapp usage snapshot:", error)
      toast.error("Não foi possível atualizar o consumo agora.")
    } finally {
      setIsRefreshingUsage(false)
    }
  }

  const save = async () => {
    if (!canManage || !tableReady || isSaving) return

    setIsSaving(true)
    const uiWatchdog = setTimeout(() => {
      setIsSaving(false)
      toast.error("Demorou demais para salvar o add-on. Tente novamente.")
    }, SAVE_WATCHDOG_MS)

    try {
      const safeQuota = toInt(includedQuota, 0, 0, 1000000)
      const safeOverage = toDecimal(overagePrice, 0, 0, 999999)
      const safeCurrency = (currencyCode || "BRL").trim().toUpperCase()
      const safeTimezone = (billingTimezone || "America/Sao_Paulo").trim()

      const response = await withTimeout(
        fetch("/api/settings/whatsapp-addon", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            addon_enabled: addonEnabled,
            included_quota: safeQuota,
            overage_price: safeOverage,
            currency_code: safeCurrency,
            billing_timezone: safeTimezone,
          }),
        })
      )

      if (!response.ok) {
        let msg = "Erro ao salvar add-on WhatsApp."
        try {
          const data = (await response.json()) as { message?: string }
          if (data?.message) msg = data.message
        } catch {
          // keep fallback error message
        }
        throw new Error(msg)
      }

      setIncludedQuota(safeQuota)
      setOveragePrice(safeOverage)
      setCurrencyCode(safeCurrency)
      setBillingTimezone(safeTimezone)
      await refreshUsage()
      toast.success("Configuração de pricing do add-on salva.")
    } catch (error) {
      console.warn("Error saving whatsapp add-on settings:", error)
      const isTimeout =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        ((error as { name?: unknown }).name === "TimeoutError" ||
          (error as { name?: unknown }).name === "AbortError")
      toast.error(
        isTimeout
          ? "Demorou demais para salvar o add-on. Tente novamente."
          : "Erro ao salvar add-on WhatsApp."
      )
    } finally {
      clearTimeout(uiWatchdog)
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
              onChange={(e) => setAddonEnabled(e.target.checked)}
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
            value={includedQuota}
            onChange={(e) => setIncludedQuota(toInt(e.target.value, 0, 0, 1000000))}
            disabled={!canManage || !tableReady || isSaving}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Preço por excedente</label>
          <Input
            type="number"
            min={0}
            max={999999}
            step="0.01"
            value={overagePrice}
            onChange={(e) => setOveragePrice(toDecimal(e.target.value, 0, 0, 999999))}
            disabled={!canManage || !tableReady || isSaving}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Moeda</label>
          <Input
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value.toUpperCase().slice(0, 3))}
            maxLength={3}
            disabled={!canManage || !tableReady || isSaving}
          />
          <p className="text-xs text-muted-foreground">Formato ISO 4217 (ex.: BRL, USD).</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Timezone de faturamento</label>
          <Input
            value={billingTimezone}
            onChange={(e) => setBillingTimezone(e.target.value)}
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
