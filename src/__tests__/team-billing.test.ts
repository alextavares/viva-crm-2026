import { calculateUpgradeProration, computeCurrentBillingCycle, getSeatCapacityAlert } from "@/lib/team/billing"

describe("team billing helpers", () => {
  it("calculates proration for upgrade", () => {
    const proration = calculateUpgradeProration({
      oldLimit: 1,
      newLimit: 3,
      unitPriceCents: 10000,
      cycleTotalDays: 30,
      cycleRemainingDays: 15,
    })

    expect(proration.seatsDelta).toBe(2)
    expect(proration.proratedAmountCents).toBe(10000)
  })

  it("computes monthly cycle window from anchor", () => {
    const cycle = computeCurrentBillingCycle("2026-02-01T00:00:00.000Z", "monthly", new Date("2026-02-20T12:00:00.000Z"))

    expect(cycle.start.toISOString()).toBe("2026-02-01T00:00:00.000Z")
    expect(cycle.end.toISOString()).toBe("2026-03-01T00:00:00.000Z")
    expect(cycle.remainingDays).toBeGreaterThan(0)
  })

  it("returns warning when only one seat remains", () => {
    const alert = getSeatCapacityAlert({ used: 2, seat_limit: 3, available: 1 }, 1)

    expect(alert?.level).toBe("warning")
  })

  it("returns limit when no seats remain", () => {
    const alert = getSeatCapacityAlert({ used: 3, seat_limit: 3, available: 0 }, 1)

    expect(alert?.level).toBe("limit")
  })

  it("returns null when below threshold", () => {
    const alert = getSeatCapacityAlert({ used: 1, seat_limit: 4, available: 3 }, 1)

    expect(alert).toBeNull()
  })
})
