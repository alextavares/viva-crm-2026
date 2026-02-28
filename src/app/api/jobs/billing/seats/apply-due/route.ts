import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Body = {
  limit?: number
  organization_id?: string | null
}

function parseLimit(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 100
  return Math.min(Math.max(Math.trunc(n), 1), 1000)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const cronSecret = process.env.BILLING_SEATS_CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const isCronRequest = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    // optional body
  }

  const limit = parseLimit(body.limit)
  let organizationId = body.organization_id ?? null

  if (!isCronRequest) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new NextResponse("Unauthorized", { status: 401 })

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id, role")
      .eq("id", user.id)
      .single()

    const role = (profile?.role as string | null) ?? null
    const canManage = role === "owner" || role === "manager"
    if (!canManage || !profile?.organization_id) return new NextResponse("Forbidden", { status: 403 })

    organizationId = profile.organization_id
  }

  const nowIso = new Date().toISOString()
  let query = supabase
    .from("broker_seat_plan_changes")
    .select("id, organization_id, requested_by, old_limit, new_limit, effective_at")
    .eq("status", "scheduled")
    .eq("action", "downgrade")
    .lte("effective_at", nowIso)
    .order("effective_at", { ascending: true })
    .limit(limit)

  if (organizationId) query = query.eq("organization_id", organizationId)

  const { data: dueChanges, error: dueChangesError } = await query
  if (dueChangesError) {
    return NextResponse.json({ ok: false, message: dueChangesError.message }, { status: 500 })
  }

  const result = {
    scanned: (dueChanges || []).length,
    applied: 0,
    blocked: 0,
  }

  for (const change of dueChanges || []) {
    const { data: usageRows, error: usageError } = await supabase.rpc("get_broker_seat_usage", {
      p_org_id: change.organization_id,
    })

    if (usageError) continue
    const usage = (Array.isArray(usageRows) ? usageRows[0] : usageRows) as
      | { used: number; seat_limit: number; available: number }
      | null
    const used = usage?.used ?? 0

    if (used > change.new_limit) {
      result.blocked += 1
      try {
        await supabase.from("team_audit_events").insert({
          organization_id: change.organization_id,
          actor_profile_id: change.requested_by,
          action: "seat_downgrade_blocked",
          level: "warning",
          message: "Downgrade não aplicado: corretores ativos acima do novo limite.",
          metadata: {
            change_id: change.id,
            used,
            new_limit: change.new_limit,
          },
        })
      } catch {
        // best effort
      }
      continue
    }

    const { error: updatePlanError } = await supabase
      .from("broker_seat_plans")
      .update({
        broker_seat_limit: change.new_limit,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", change.organization_id)

    if (updatePlanError) continue

    const { error: updateChangeError } = await supabase
      .from("broker_seat_plan_changes")
      .update({
        status: "applied",
        updated_at: new Date().toISOString(),
      })
      .eq("id", change.id)

    if (updateChangeError) continue

    result.applied += 1
    try {
      await supabase.from("team_audit_events").insert({
        organization_id: change.organization_id,
        actor_profile_id: change.requested_by,
        action: "seat_downgrade_applied",
        level: "info",
        message: "Downgrade de assentos aplicado na virada do ciclo.",
        metadata: {
          change_id: change.id,
          old_limit: change.old_limit,
          new_limit: change.new_limit,
        },
      })
    } catch {
      // best effort
    }
  }

  return NextResponse.json({ ok: true, result })
}

