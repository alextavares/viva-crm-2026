"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SeatCapacityAlert } from "@/components/team/seat-capacity-alert"
import { getSeatCapacityAlert } from "@/lib/team/billing"

type BillingResponse = {
  ok: boolean
  plan: {
    broker_seat_limit: number
    billing_cycle_anchor: string
    billing_cycle_interval: "monthly" | "yearly"
    status: "active" | "inactive"
  }
  usage: {
    used: number
    seat_limit: number
    available: number
  }
  cycle: {
    start: string
    end: string
    interval: "monthly" | "yearly"
    total_days: number
    remaining_days: number
  }
  pending_change: {
    id: string
    action: "downgrade" | "upgrade"
    status: string
    old_limit: number
    new_limit: number
    effective_at: string
  } | null
  history: Array<{
    id: string
    action: "downgrade" | "upgrade"
    status: string
    old_limit: number
    new_limit: number
    effective_at: string
    prorated_amount_cents: number
    currency_code: string
    created_at: string
  }>
}

export function BillingSeatsForm({ canManage }: { canManage: boolean }) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<BillingResponse | null>(null)

  const [upgradeLimit, setUpgradeLimit] = useState("")
  const [unitPriceCents, setUnitPriceCents] = useState("0")
  const [downgradeLimit, setDowngradeLimit] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/settings/billing/seats", { cache: "no-store" })
      const json = (await response.json()) as BillingResponse | { message?: string }
      if (!response.ok || !("ok" in json) || !json.ok) {
        throw new Error(("message" in json && json.message) || "Falha ao carregar cobrança.")
      }
      setData(json)
      setUpgradeLimit(String((json.plan?.broker_seat_limit ?? 0) + 1))
      setDowngradeLimit(String(Math.max(0, (json.plan?.broker_seat_limit ?? 0) - 1)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar cobrança.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cycleText = useMemo(() => {
    if (!data) return ""
    const start = new Date(data.cycle.start).toLocaleDateString("pt-BR")
    const end = new Date(data.cycle.end).toLocaleDateString("pt-BR")
    return `${start} até ${end}`
  }, [data])
  const capacityAlert = useMemo(() => getSeatCapacityAlert(data?.usage, 1), [data?.usage])

  async function submitChange(payload: { action: "upgrade" | "downgrade"; new_limit: number; unit_price_cents?: number }) {
    setSubmitting(true)
    try {
      const response = await fetch("/api/settings/billing/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await response.json()) as { ok?: boolean; message?: string; code?: string; change?: { prorated_amount_cents?: number } }
      if (!response.ok || !json.ok) {
        throw new Error(json.message || "Falha ao salvar mudança de assentos.")
      }

      if (payload.action === "upgrade") {
        const cents = json.change?.prorated_amount_cents ?? 0
        toast.success(`Upgrade aplicado. Pró-rata calculado: ${(cents / 100).toFixed(2)}.`)
      } else {
        toast.success("Downgrade agendado para o próximo ciclo.")
      }
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar alteração.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Plano atual</h2>
        {loading || !data ? (
          <p className="mt-2 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p>
              Assentos broker: <span className="font-medium text-foreground">{data.plan.broker_seat_limit}</span>
            </p>
            <p>
              Uso atual: <span className="font-medium text-foreground">{data.usage.used}</span> /{" "}
              <span className="font-medium text-foreground">{data.usage.seat_limit}</span>
            </p>
            <p>
              Ciclo atual: <span className="font-medium text-foreground">{cycleText}</span> ({data.cycle.remaining_days} dias restantes)
            </p>
            {data.pending_change ? (
              <p>
                Downgrade pendente para <span className="font-medium text-foreground">{data.pending_change.new_limit}</span> assentos em{" "}
                <span className="font-medium text-foreground">{new Date(data.pending_change.effective_at).toLocaleDateString("pt-BR")}</span>.
              </p>
            ) : null}
          </div>
        )}
      </section>

      {capacityAlert ? <SeatCapacityAlert alert={capacityAlert} /> : null}

      <section className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Upgrade imediato (pró-rata)</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="upgrade-limit">Novo limite</Label>
            <Input
              id="upgrade-limit"
              type="number"
              min={0}
              value={upgradeLimit}
              onChange={(e) => setUpgradeLimit(e.target.value)}
              disabled={!canManage || submitting || loading}
            />
          </div>
          <div>
            <Label htmlFor="unit-price-cents">Preço por assento (centavos)</Label>
            <Input
              id="unit-price-cents"
              type="number"
              min={0}
              value={unitPriceCents}
              onChange={(e) => setUnitPriceCents(e.target.value)}
              disabled={!canManage || submitting || loading}
            />
          </div>
          <div className="flex items-end">
            <Button
              disabled={!canManage || submitting || loading}
              onClick={() =>
                submitChange({
                  action: "upgrade",
                  new_limit: Number(upgradeLimit),
                  unit_price_cents: Number(unitPriceCents),
                })
              }
            >
              {submitting ? "Salvando..." : "Aplicar upgrade"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-md border p-4">
        <h2 className="text-sm font-semibold">Downgrade próximo ciclo</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="downgrade-limit">Novo limite</Label>
            <Input
              id="downgrade-limit"
              type="number"
              min={0}
              value={downgradeLimit}
              onChange={(e) => setDowngradeLimit(e.target.value)}
              disabled={!canManage || submitting || loading}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              disabled={!canManage || submitting || loading}
              onClick={() =>
                submitChange({
                  action: "downgrade",
                  new_limit: Number(downgradeLimit),
                })
              }
            >
              {submitting ? "Salvando..." : "Agendar downgrade"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
