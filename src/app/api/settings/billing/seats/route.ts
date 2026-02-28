import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { calculateUpgradeProration, computeCurrentBillingCycle, normalizeInterval } from "@/lib/team/billing"

type ChangeAction = "upgrade" | "downgrade"

type Body = {
  action?: ChangeAction
  new_limit?: number
  unit_price_cents?: number
  currency_code?: string
  notes?: string
}

function toInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

async function getContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, error: new NextResponse("Unauthorized", { status: 401 }) }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", user.id)
    .single()
  if (profileError || !profile?.organization_id) {
    return { supabase, error: new NextResponse("Forbidden", { status: 403 }) }
  }

  const role = (profile.role as string | null) ?? null
  if (role !== "owner" && role !== "manager") {
    return { supabase, error: new NextResponse("Forbidden", { status: 403 }) }
  }

  return {
    supabase,
    actorId: profile.id as string,
    organizationId: profile.organization_id as string,
    error: null,
  }
}

async function insertAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    organizationId: string
    actorId: string
    action: string
    level: "info" | "warning" | "error"
    message: string
    metadata?: Record<string, unknown>
  }
) {
  try {
    await supabase.from("team_audit_events").insert({
      organization_id: params.organizationId,
      actor_profile_id: params.actorId,
      action: params.action,
      level: params.level,
      message: params.message,
      metadata: params.metadata || {},
    })
  } catch {
    // best effort
  }
}

export async function GET() {
  const ctx = await getContext()
  if (ctx.error) return ctx.error
  const { supabase, organizationId } = ctx

  const [planRes, usageRes, pendingRes, historyRes] = await Promise.all([
    supabase
      .from("broker_seat_plans")
      .select("organization_id, broker_seat_limit, billing_cycle_anchor, billing_cycle_interval, status")
      .eq("organization_id", organizationId)
      .single(),
    supabase.rpc("get_broker_seat_usage", { p_org_id: organizationId }).single(),
    supabase
      .from("broker_seat_plan_changes")
      .select(
        "id, action, status, old_limit, new_limit, effective_at, currency_code, unit_price_cents, prorated_amount_cents, proration_days_total, proration_days_remaining, notes, created_at"
      )
      .eq("organization_id", organizationId)
      .eq("status", "scheduled")
      .order("effective_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("broker_seat_plan_changes")
      .select(
        "id, action, status, old_limit, new_limit, effective_at, currency_code, unit_price_cents, prorated_amount_cents, proration_days_total, proration_days_remaining, notes, created_at"
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  if (planRes.error) return NextResponse.json({ ok: false, message: planRes.error.message }, { status: 500 })
  if (usageRes.error) return NextResponse.json({ ok: false, message: usageRes.error.message }, { status: 500 })
  if (pendingRes.error) return NextResponse.json({ ok: false, message: pendingRes.error.message }, { status: 500 })
  if (historyRes.error) return NextResponse.json({ ok: false, message: historyRes.error.message }, { status: 500 })

  const plan = planRes.data
  const usage = usageRes.data
  const interval = normalizeInterval(plan.billing_cycle_interval)
  const cycle = computeCurrentBillingCycle(plan.billing_cycle_anchor, interval)

  return NextResponse.json({
    ok: true,
    plan,
    usage,
    cycle: {
      start: cycle.start.toISOString(),
      end: cycle.end.toISOString(),
      interval: cycle.interval,
      total_days: cycle.totalDays,
      remaining_days: cycle.remainingDays,
    },
    pending_change: pendingRes.data,
    history: historyRes.data || [],
  })
}

export async function POST(req: Request) {
  const ctx = await getContext()
  if (ctx.error) return ctx.error
  const { supabase, organizationId, actorId } = ctx

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return new NextResponse("Bad Request", { status: 400 })
  }

  const action = body.action === "downgrade" ? "downgrade" : "upgrade"
  const newLimit = toInt(body.new_limit, -1, 0, 1_000_000)
  const unitPriceCents = toInt(body.unit_price_cents, 0, 0, 10_000_000)
  const currencyCode = (body.currency_code || "BRL").trim().toUpperCase()
  const notes = (body.notes || "").trim() || null

  if (newLimit < 0) {
    return NextResponse.json({ ok: false, code: "validation_error", message: "new_limit inválido." }, { status: 400 })
  }
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return NextResponse.json({ ok: false, code: "validation_error", message: "currency_code inválido." }, { status: 400 })
  }

  const [planRes, usageRes] = await Promise.all([
    supabase
      .from("broker_seat_plans")
      .select("organization_id, broker_seat_limit, billing_cycle_anchor, billing_cycle_interval, status")
      .eq("organization_id", organizationId)
      .single(),
    supabase.rpc("get_broker_seat_usage", { p_org_id: organizationId }).single(),
  ])

  if (planRes.error) return NextResponse.json({ ok: false, message: planRes.error.message }, { status: 500 })
  if (usageRes.error) return NextResponse.json({ ok: false, message: usageRes.error.message }, { status: 500 })

  const plan = planRes.data
  const usage = usageRes.data as { used: number; seat_limit: number; available: number }
  const currentLimit = Number(plan.broker_seat_limit || 0)
  const now = new Date()
  const cycle = computeCurrentBillingCycle(plan.billing_cycle_anchor, plan.billing_cycle_interval, now)

  if (action === "upgrade") {
    if (newLimit <= currentLimit) {
      return NextResponse.json(
        { ok: false, code: "validation_error", message: "Upgrade exige novo limite maior que o limite atual." },
        { status: 400 }
      )
    }

    const proration = calculateUpgradeProration({
      oldLimit: currentLimit,
      newLimit,
      unitPriceCents,
      cycleTotalDays: cycle.totalDays,
      cycleRemainingDays: cycle.remainingDays,
    })

    const { error: updatePlanError } = await supabase
      .from("broker_seat_plans")
      .update({
        broker_seat_limit: newLimit,
        updated_at: now.toISOString(),
      })
      .eq("organization_id", organizationId)

    if (updatePlanError) {
      return NextResponse.json({ ok: false, message: updatePlanError.message }, { status: 500 })
    }

    const { data: change, error: insertChangeError } = await supabase
      .from("broker_seat_plan_changes")
      .insert({
        organization_id: organizationId,
        requested_by: actorId,
        action: "upgrade",
        status: "applied",
        old_limit: currentLimit,
        new_limit: newLimit,
        effective_at: now.toISOString(),
        currency_code: currencyCode,
        unit_price_cents: proration.unitPriceCents,
        prorated_amount_cents: proration.proratedAmountCents,
        proration_days_total: proration.totalDays,
        proration_days_remaining: proration.remainingDays,
        notes,
        metadata: {
          seats_delta: proration.seatsDelta,
          cycle_start: cycle.start.toISOString(),
          cycle_end: cycle.end.toISOString(),
          at: now.toISOString(),
        },
      })
      .select("*")
      .single()

    if (insertChangeError) {
      return NextResponse.json({ ok: false, message: insertChangeError.message }, { status: 500 })
    }

    await insertAudit(supabase, {
      organizationId,
      actorId,
      action: "seat_upgrade_applied",
      level: "info",
      message: "Upgrade de assentos aplicado com pró-rata.",
      metadata: {
        old_limit: currentLimit,
        new_limit: newLimit,
        prorated_amount_cents: proration.proratedAmountCents,
        currency_code: currencyCode,
      },
    })

    return NextResponse.json({
      ok: true,
      change,
      mode: "upgrade_applied",
      usage_before: usage,
    })
  }

  if (newLimit >= currentLimit) {
    return NextResponse.json(
      { ok: false, code: "validation_error", message: "Downgrade exige novo limite menor que o limite atual." },
      { status: 400 }
    )
  }

  if (usage.used > newLimit) {
    return NextResponse.json(
      {
        ok: false,
        code: "downgrade_below_active_brokers",
        message: `Existem ${usage.used} corretores ativos. Reduza para no máximo ${newLimit} antes do downgrade.`,
      },
      { status: 409 }
    )
  }

  const { data: existingScheduled, error: existingScheduledError } = await supabase
    .from("broker_seat_plan_changes")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "scheduled")
    .eq("action", "downgrade")
    .maybeSingle()

  if (existingScheduledError) {
    return NextResponse.json({ ok: false, message: existingScheduledError.message }, { status: 500 })
  }
  if (existingScheduled?.id) {
    return NextResponse.json(
      { ok: false, code: "downgrade_already_scheduled", message: "Já existe downgrade agendado para este ciclo." },
      { status: 409 }
    )
  }

  const { data: change, error: insertChangeError } = await supabase
    .from("broker_seat_plan_changes")
    .insert({
      organization_id: organizationId,
      requested_by: actorId,
      action: "downgrade",
      status: "scheduled",
      old_limit: currentLimit,
      new_limit: newLimit,
      effective_at: cycle.end.toISOString(),
      currency_code: currencyCode,
      unit_price_cents: unitPriceCents,
      prorated_amount_cents: 0,
      proration_days_total: cycle.totalDays,
      proration_days_remaining: cycle.remainingDays,
      notes,
      metadata: {
        scheduled_at: now.toISOString(),
        cycle_start: cycle.start.toISOString(),
        cycle_end: cycle.end.toISOString(),
      },
    })
    .select("*")
    .single()

  if (insertChangeError) {
    return NextResponse.json({ ok: false, message: insertChangeError.message }, { status: 500 })
  }

  await insertAudit(supabase, {
    organizationId,
    actorId,
    action: "seat_downgrade_scheduled",
    level: "info",
    message: "Downgrade de assentos agendado para o próximo ciclo.",
    metadata: {
      old_limit: currentLimit,
      new_limit: newLimit,
      effective_at: cycle.end.toISOString(),
    },
  })

  return NextResponse.json({
    ok: true,
    change,
    mode: "downgrade_scheduled",
    usage_current: usage,
  })
}

