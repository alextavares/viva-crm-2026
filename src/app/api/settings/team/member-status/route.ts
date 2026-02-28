import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { mapTeamBusinessError } from "@/lib/team/errors"

type Body = {
  profile_id?: string
  is_active?: boolean
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

  const profileId = (body.profile_id || "").trim()
  if (!profileId || typeof body.is_active !== "boolean") {
    return new NextResponse("Bad Request", { status: 400 })
  }

  const { data: actor, error: actorError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (actorError || !actor?.organization_id) return new NextResponse("Forbidden", { status: 403 })

  const actorRole = (actor.role as string | null) ?? null
  if (actorRole !== "owner" && actorRole !== "manager") return new NextResponse("Forbidden", { status: 403 })

  const organizationId = actor.organization_id as string
  const actorId = user.id

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, organization_id, role, is_active")
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (targetError) {
    return NextResponse.json({ ok: false, message: targetError.message }, { status: 500 })
  }
  if (!target) {
    return NextResponse.json({ ok: false, message: "Corretor não encontrado na organização." }, { status: 404 })
  }
  if ((target.role as string) !== "broker") {
    return NextResponse.json({ ok: false, message: "Apenas usuários broker podem ser ativados/desativados." }, { status: 400 })
  }
  if ((target.is_active as boolean) === body.is_active) {
    return NextResponse.json({ ok: true, profile_id: profileId, is_active: body.is_active, unchanged: true })
  }

  async function audit(action: string, level: "info" | "warning" | "error", message: string, metadata?: Record<string, unknown>) {
    try {
      await supabase.from("team_audit_events").insert({
        organization_id: organizationId,
        actor_profile_id: actorId,
        target_profile_id: profileId,
        action,
        level,
        message,
        metadata: metadata || {},
      })
    } catch {
      // best effort audit trail; do not fail primary operation
    }
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      is_active: body.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profileId)
    .eq("organization_id", organizationId)

  if (updateError) {
    const mapped = mapTeamBusinessError(updateError)
    if (mapped.code === "broker_seat_limit_reached") {
      await audit("member_status_blocked_limit", "warning", mapped.message, {
        desired_is_active: body.is_active,
      })
      return NextResponse.json({ ok: false, code: mapped.code, message: mapped.message }, { status: 409 })
    }
    await audit("member_status_update_failed", "error", mapped.message, {
      desired_is_active: body.is_active,
    })
    return NextResponse.json({ ok: false, code: mapped.code, message: mapped.message }, { status: 500 })
  }

  await audit(
    body.is_active ? "member_reactivated" : "member_deactivated",
    "info",
    body.is_active ? "Corretor reativado com sucesso." : "Corretor desativado com sucesso."
  )

  return NextResponse.json({
    ok: true,
    profile_id: profileId,
    is_active: body.is_active,
  })
}
