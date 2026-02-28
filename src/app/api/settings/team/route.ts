import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type TeamUsageRow = {
  used: number
  seat_limit: number
  available: number
}

type TeamMemberRow = {
  id: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string | null
  updated_at: string | null
}

type TeamInviteRow = {
  id: string
  email: string
  role: string
  status: string
  expires_at: string | null
  created_at: string
}

type TeamAuditEventRow = {
  id: string
  action: string
  level: "info" | "warning" | "error"
  message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.organization_id) return new NextResponse("Forbidden", { status: 403 })

  const role = (profile.role as string | null) ?? null
  if (role !== "owner" && role !== "manager") return new NextResponse("Forbidden", { status: 403 })

  const organizationId = profile.organization_id as string

  const [membersResult, usageResult, invitesResult, auditResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, is_active, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
    supabase.rpc("get_broker_seat_usage", { p_org_id: organizationId }).single(),
    supabase
      .from("team_invites")
      .select("id, email, role, status, expires_at, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("team_audit_events")
      .select("id, action, level, message, metadata, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
  ])

  if (membersResult.error) {
    return NextResponse.json({ ok: false, message: membersResult.error.message }, { status: 500 })
  }
  if (usageResult.error) {
    return NextResponse.json({ ok: false, message: usageResult.error.message }, { status: 500 })
  }
  if (invitesResult.error) {
    return NextResponse.json({ ok: false, message: invitesResult.error.message }, { status: 500 })
  }
  if (auditResult.error) {
    return NextResponse.json({ ok: false, message: auditResult.error.message }, { status: 500 })
  }

  const members = ((membersResult.data as TeamMemberRow[] | null) || []).map((member) => ({
    id: member.id,
    full_name: member.full_name,
    role: member.role,
    is_active: member.is_active,
    consumes_seat: member.role === "broker" && member.is_active,
    created_at: member.created_at,
    updated_at: member.updated_at,
  }))

  const usage = ((usageResult.data as TeamUsageRow | null) ?? {
    used: 0,
    seat_limit: 1,
    available: 1,
  }) as TeamUsageRow

  const invites = ((invitesResult.data as TeamInviteRow[] | null) || []).map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expires_at: invite.expires_at,
    created_at: invite.created_at,
  }))

  const audit_events = ((auditResult.data as TeamAuditEventRow[] | null) || []).map((evt) => ({
    id: evt.id,
    action: evt.action,
    level: evt.level,
    message: evt.message,
    metadata: evt.metadata || {},
    created_at: evt.created_at,
  }))

  return NextResponse.json({
    ok: true,
    organization_id: organizationId,
    usage,
    members,
    invites,
    audit_events,
  })
}
