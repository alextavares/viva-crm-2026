"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SeatCapacityAlert } from "@/components/team/seat-capacity-alert"
import { getSeatCapacityAlert } from "@/lib/team/billing"
import { displayEmptyForZero } from "@/lib/utils"

import { loadBillingSeatsData, applyBrokerSeatPlanChange, type BillingSeatsData } from "@/app/actions/team"

export function BillingSeatsForm({ canManage }: { canManage: boolean }) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState<BillingSeatsData | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [upgradeLimit, setUpgradeLimit] = useState("")
  const [unitPriceCents, setUnitPriceCents] = useState("0")
  const [downgradeLimit, setDowngradeLimit] = useState("")

  const load = useCallback(async () => {
    if (!canManage) return

    setLoading(true)
    const result = await loadBillingSeatsData()
    if (result.success) {
      setData(result.data)
      setUpgradeLimit(String((result.data.plan?.broker_seat_limit ?? 0) + 1))
      setDowngradeLimit(String(Math.max(0, (result.data.plan?.broker_seat_limit ?? 0) - 1)))
      setErrorMsg(null)
    } else {
      const message = result.error || "Falha ao carregar cobrança."
      setErrorMsg(message)
      toast.error(message)
    }
    setLoading(false)
  }, [canManage])

  useEffect(() => {
    if (!canManage) return

    const timeoutId = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [canManage, load])

  const cycleText = useMemo(() => {
    if (!data) return ""
    const start = new Date(data.cycle.start).toLocaleDateString("pt-BR")
    const end = new Date(data.cycle.end).toLocaleDateString("pt-BR")
    return `${start} até ${end}`
  }, [data])
  const capacityAlert = useMemo(() => getSeatCapacityAlert(data?.usage || null, 1), [data?.usage])

  async function submitChange(payload: { action: "upgrade" | "downgrade"; new_limit: number; unit_price_cents?: number }) {
    setSubmitting(true)
    setErrorMsg(null)
    const result = await applyBrokerSeatPlanChange({
      action: payload.action,
      newLimit: payload.new_limit,
      unitPriceCents: payload.unit_price_cents,
      currencyCode: "BRL",
    })

    if (result.success) {
      if (payload.action === "upgrade") {
        const cents = result.data.prorated_amount_cents ?? 0
        toast.success(`Upgrade aplicado. Pró-rata calculado: R$ ${(cents / 100).toFixed(2).replace(".", ",")}.`)
      } else {
        toast.success("Downgrade agendado para o próximo ciclo.")
      }
      await load()
    } else {
      const message = result.error || "Falha ao atualizar assentos."
      setErrorMsg(message)
      toast.error(message)
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}

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
              value={displayEmptyForZero(upgradeLimit)}
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
              value={displayEmptyForZero(unitPriceCents)}
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
              value={displayEmptyForZero(downgradeLimit)}
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
