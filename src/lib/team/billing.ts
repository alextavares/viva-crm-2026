const DAY_MS = 24 * 60 * 60 * 1000

export type BillingInterval = "monthly" | "yearly"
export type SeatCapacityAlertLevel = "warning" | "limit"

export type SeatUsageSnapshot = {
  used: number
  seat_limit: number
  available: number
}

export type SeatCapacityAlert = {
  level: SeatCapacityAlertLevel
  threshold: number
  message: string
}

export function normalizeInterval(value: string | null | undefined): BillingInterval {
  return value === "yearly" ? "yearly" : "monthly"
}

function addInterval(date: Date, interval: BillingInterval, steps = 1) {
  const d = new Date(date.getTime())
  if (interval === "yearly") {
    d.setUTCFullYear(d.getUTCFullYear() + steps)
  } else {
    d.setUTCMonth(d.getUTCMonth() + steps)
  }
  return d
}

export function computeCurrentBillingCycle(anchorInput: string | Date, intervalInput: string | null | undefined, nowInput = new Date()) {
  const interval = normalizeInterval(intervalInput)
  const now = new Date(nowInput)
  let start = new Date(anchorInput)

  if (Number.isNaN(start.getTime())) start = new Date(now)

  let guard = 0
  while (start.getTime() > now.getTime() && guard < 600) {
    start = addInterval(start, interval, -1)
    guard += 1
  }

  guard = 0
  while (guard < 600) {
    const next = addInterval(start, interval, 1)
    if (next.getTime() > now.getTime()) break
    start = next
    guard += 1
  }

  const end = addInterval(start, interval, 1)
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS))
  const remainingDays = Math.max(0, Math.min(totalDays, Math.ceil((end.getTime() - now.getTime()) / DAY_MS)))

  return {
    start,
    end,
    totalDays,
    remainingDays,
    interval,
  }
}

export function calculateUpgradeProration(params: {
  oldLimit: number
  newLimit: number
  unitPriceCents: number
  cycleTotalDays: number
  cycleRemainingDays: number
}) {
  const seatsDelta = Math.max(0, params.newLimit - params.oldLimit)
  const unitPrice = Math.max(0, params.unitPriceCents)
  const totalDays = Math.max(1, params.cycleTotalDays)
  const remainingDays = Math.max(0, Math.min(totalDays, params.cycleRemainingDays))

  const numerator = seatsDelta * unitPrice * remainingDays
  const proratedAmountCents = seatsDelta <= 0 || unitPrice <= 0 ? 0 : Math.round(numerator / totalDays)

  return {
    seatsDelta,
    unitPriceCents: unitPrice,
    proratedAmountCents,
    totalDays,
    remainingDays,
  }
}

export function getSeatCapacityAlert(
  usageInput: SeatUsageSnapshot | null | undefined,
  thresholdInput = 1
): SeatCapacityAlert | null {
  if (!usageInput) return null

  const used = Number(usageInput.used)
  const seatLimit = Number(usageInput.seat_limit)
  const available = Number(usageInput.available)
  const threshold = Math.max(0, Math.trunc(thresholdInput))

  if (!Number.isFinite(used) || !Number.isFinite(seatLimit) || !Number.isFinite(available)) return null
  if (seatLimit <= 0) return null
  if (used <= 0) return null

  if (available <= 0) {
    return {
      level: "limit",
      threshold,
      message: "Limite de assentos atingido. Faça upgrade para evitar bloqueios de operação.",
    }
  }

  if (available <= threshold) {
    const seatWord = available === 1 ? "assento" : "assentos"
    return {
      level: "warning",
      threshold,
      message: `Capacidade quase no limite: restam ${available} ${seatWord}. Avalie upgrade preventivo.`,
    }
  }

  return null
}
