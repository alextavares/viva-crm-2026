import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { mapTeamBusinessError } from "@/lib/team/errors"

type Body = {
  email?: string
  role?: "broker" | "assistant" | "manager"
  full_name?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  const email = (body.email || "").trim().toLowerCase()
  const fullName = (body.full_name || "").trim() || null
  const targetRole = body.role === "assistant" || body.role === "manager" ? body.role : "broker"

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, message: "Email inválido." }, { status: 400 })
  }

  const { data: actor, error: actorError } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", user.id)
    .single()

  if (actorError || !actor?.organization_id) return new NextResponse("Forbidden", { status: 403 })

  const actorRole = (actor.role as string | null) ?? null
  if (actorRole !== "owner" && actorRole !== "manager") return new NextResponse("Forbidden", { status: 403 })

  const organizationId = actor.organization_id as string
  const actorId = actor.id as string

  async function audit(
    action: string,
    level: "info" | "warning" | "error",
    message: string,
    metadata?: Record<string, unknown>
  ) {
    try {
      await supabase.from("team_audit_events").insert({
        organization_id: organizationId,
        actor_profile_id: actorId,
        action,
        level,
        message,
        metadata: metadata || {},
      })
    } catch {
      // best effort audit trail
    }
  }

  const { data: existingPending, error: pendingError } = await supabase
    .from("team_invites")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .ilike("email", email)
    .maybeSingle()

  if (pendingError) {
    return NextResponse.json({ ok: false, message: pendingError.message }, { status: 500 })
  }
  if (existingPending?.id) {
    await audit("invite_blocked_pending", "warning", "Convite pendente já existe para este email.", {
      email,
      role: targetRole,
    })
    return NextResponse.json(
      { ok: false, code: "invite_already_pending", message: "Já existe convite pendente para este email." },
      { status: 409 }
    )
  }

  // For broker invites, reserve capacity upfront to avoid oversubscription.
  if (targetRole === "broker") {
    const { data: usageRows, error: usageError } = await supabase.rpc("get_broker_seat_usage", {
      p_org_id: organizationId,
    })
    if (usageError) {
      return NextResponse.json({ ok: false, message: usageError.message }, { status: 500 })
    }

    const usage = (Array.isArray(usageRows) ? usageRows[0] : usageRows) as
      | { used: number; seat_limit: number; available: number }
      | null
    if ((usage?.available ?? 0) <= 0) {
      await audit("invite_blocked_limit", "warning", "Limite de corretores do plano atingido.", {
        email,
        role: targetRole,
        used: usage?.used ?? 0,
        seat_limit: usage?.seat_limit ?? 0,
      })
      return NextResponse.json(
        {
          ok: false,
          code: "broker_seat_limit_reached",
          message: `Limite de corretores do plano atingido (${usage?.used ?? 0}/${usage?.seat_limit ?? 0}).`,
        },
        { status: 409 }
      )
    }
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invite, error: inviteInsertError } = await supabase
    .from("team_invites")
    .insert({
      organization_id: organizationId,
      email,
      role: targetRole,
      invited_by: actorId,
      status: "pending",
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (inviteInsertError) {
    const mapped = mapTeamBusinessError(inviteInsertError)
    await audit("invite_create_failed", "error", mapped.message, {
      email,
      role: targetRole,
    })
    return NextResponse.json({ ok: false, code: mapped.code, message: mapped.message }, { status: 500 })
  }

  try {
    const admin = createAdminClient()
    const url = new URL(req.url)
    const redirectTo = `${url.origin}/auth/callback?next=/dashboard`

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        full_name: fullName,
      },
    })

    if (inviteError) {
      await supabase.from("team_invites").delete().eq("id", invite.id)
      const mapped = mapTeamBusinessError(inviteError)
      await audit("invite_provider_failed", "error", mapped.message, {
        email,
        role: targetRole,
      })
      return NextResponse.json({ ok: false, code: mapped.code, message: mapped.message }, { status: 500 })
    }
  } catch (error) {
    await supabase.from("team_invites").delete().eq("id", invite.id)
    const message = error instanceof Error ? error.message : "Falha ao enviar convite."
    await audit("invite_provider_failed", "error", message, {
      email,
      role: targetRole,
    })
    return NextResponse.json({ ok: false, code: "unknown", message }, { status: 500 })
  }

  await audit("invite_created", "info", "Convite de equipe criado com sucesso.", {
    email,
    role: targetRole,
    invite_id: invite.id,
  })

  return NextResponse.json({
    ok: true,
    invite_id: invite.id,
    email,
    role: targetRole,
    expires_at: expiresAt,
  })
}
