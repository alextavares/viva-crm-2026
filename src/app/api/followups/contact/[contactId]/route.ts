import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type ActionBody = {
  action?: "pause" | "resume" | "cancel"
}

interface RouteParams {
  params: Promise<{ contactId: string }>
}

export async function POST(req: Request, { params }: RouteParams) {
  const { contactId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  let body: ActionBody
  try {
    body = (await req.json()) as ActionBody
  } catch {
    return new NextResponse("Bad Request", { status: 400 })
  }

  if (!body.action || !["pause", "resume", "cancel"].includes(body.action)) {
    return new NextResponse("Bad Request", { status: 400 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  const role = (profile?.role as string | null) ?? null
  const canManage = role === "owner" || role === "manager"
  const organizationId = profile?.organization_id ?? null
  if (!canManage || !organizationId) return new NextResponse("Forbidden", { status: 403 })

  const { data: contact } = await supabase
    .from("contacts")
    .select("id, organization_id")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!contact) return new NextResponse("Not Found", { status: 404 })

  if (body.action === "pause") {
    const { data, error } = await supabase
      .from("followup_jobs")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .eq("status", "pending")
      .select("id")

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: "pause", affected: data?.length ?? 0 })
  }

  if (body.action === "cancel") {
    const { data, error } = await supabase
      .from("followup_jobs")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .in("status", ["pending", "paused"])
      .select("id")

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: "cancel", affected: data?.length ?? 0 })
  }

  const { data: pausedJobs, error: pausedError } = await supabase
    .from("followup_jobs")
    .select("id, scheduled_at")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("status", "paused")
    .order("scheduled_at", { ascending: true })

  if (pausedError) {
    return NextResponse.json({ ok: false, message: pausedError.message }, { status: 500 })
  }

  const now = Date.now()
  let affected = 0
  for (const job of pausedJobs || []) {
    const scheduledAt = new Date(job.scheduled_at).getTime()
    const nextScheduledAt = new Date(Math.max(scheduledAt, now + 10_000)).toISOString()
    const { error } = await supabase
      .from("followup_jobs")
      .update({
        status: "pending",
        scheduled_at: nextScheduledAt,
        updated_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", job.id)
      .eq("organization_id", organizationId)

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
    }
    affected += 1
  }

  return NextResponse.json({ ok: true, action: "resume", affected })
}

