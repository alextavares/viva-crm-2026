import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type OverrideInput = {
  profile_id: string
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

type Body = {
  section?: "all" | "global" | "overrides"
  enabled?: boolean
  period_type?: "weekly" | "monthly"
  metric_captacoes_enabled?: boolean
  metric_respostas_enabled?: boolean
  metric_visitas_enabled?: boolean
  response_sla_minutes?: number
  target_captacoes?: number
  target_respostas?: number
  target_visitas?: number
  overrides?: OverrideInput[]
}

function toInt(v: unknown, fallback: number, min: number, max: number) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return new NextResponse("Bad Request", { status: 400 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.organization_id) return new NextResponse("Forbidden", { status: 403 })

  const role = (profile.role as string | null) ?? null
  const canManage = role === "owner" || role === "manager"
  if (!canManage) return new NextResponse("Forbidden", { status: 403 })

  const organizationId = profile.organization_id as string
  const saveSection =
    body.section === "global" || body.section === "overrides" || body.section === "all"
      ? body.section
      : "all"

  const periodType = body.period_type === "monthly" ? "monthly" : "weekly"
  const safeSla = toInt(body.response_sla_minutes, 15, 1, 1440)
  const safeTargetCap = toInt(body.target_captacoes, 4, 0, 100000)
  const safeTargetResp = toInt(body.target_respostas, 20, 0, 100000)
  const safeTargetVisitas = toInt(body.target_visitas, 6, 0, 100000)

  if (saveSection !== "overrides") {
    const { error: settingsError } = await supabase.from("goal_settings").upsert({
      organization_id: organizationId,
      enabled: Boolean(body.enabled),
      period_type: periodType,
      metric_captacoes_enabled: body.metric_captacoes_enabled ?? true,
      metric_respostas_enabled: body.metric_respostas_enabled ?? true,
      metric_visitas_enabled: body.metric_visitas_enabled ?? true,
      response_sla_minutes: safeSla,
      target_captacoes: safeTargetCap,
      target_respostas: safeTargetResp,
      target_visitas: safeTargetVisitas,
      updated_at: new Date().toISOString(),
    })
    if (settingsError) {
      return NextResponse.json({ ok: false, message: settingsError.message }, { status: 500 })
    }
  }

  if (saveSection !== "global") {
    const { error: clearError } = await supabase
      .from("goal_broker_overrides")
      .delete()
      .eq("organization_id", organizationId)
    if (clearError) {
      return NextResponse.json({ ok: false, message: clearError.message }, { status: 500 })
    }

    const rows = Array.isArray(body.overrides) ? body.overrides : []
    const overridePayload = rows
      .map((row) => {
        const period = row.period_type === "weekly" || row.period_type === "monthly" ? row.period_type : null
        const responseSla = row.response_sla_minutes == null ? null : toInt(row.response_sla_minutes, 15, 1, 1440)
        const targetCap = row.target_captacoes == null ? null : toInt(row.target_captacoes, 0, 0, 100000)
        const targetResp = row.target_respostas == null ? null : toInt(row.target_respostas, 0, 0, 100000)
        const targetVisitas = row.target_visitas == null ? null : toInt(row.target_visitas, 0, 0, 100000)

        const hasAnyExplicitOverride =
          row.enabled === false ||
          period !== null ||
          row.metric_captacoes_enabled !== null ||
          row.metric_respostas_enabled !== null ||
          row.metric_visitas_enabled !== null ||
          responseSla !== null ||
          targetCap !== null ||
          targetResp !== null ||
          targetVisitas !== null
        if (!hasAnyExplicitOverride) return null

        return {
          organization_id: organizationId,
          profile_id: row.profile_id,
          enabled: Boolean(row.enabled),
          period_type: period,
          metric_captacoes_enabled:
            typeof row.metric_captacoes_enabled === "boolean" ? row.metric_captacoes_enabled : null,
          metric_respostas_enabled:
            typeof row.metric_respostas_enabled === "boolean" ? row.metric_respostas_enabled : null,
          metric_visitas_enabled:
            typeof row.metric_visitas_enabled === "boolean" ? row.metric_visitas_enabled : null,
          response_sla_minutes: responseSla,
          target_captacoes: targetCap,
          target_respostas: targetResp,
          target_visitas: targetVisitas,
          updated_at: new Date().toISOString(),
        }
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row))

    if (overridePayload.length > 0) {
      const { error: insertError } = await supabase.from("goal_broker_overrides").insert(overridePayload)
      if (insertError) {
        return NextResponse.json({ ok: false, message: insertError.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true, section: saveSection })
}
