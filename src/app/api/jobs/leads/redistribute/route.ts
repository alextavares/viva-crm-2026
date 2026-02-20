import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type ProcessBody = {
  limit?: number
  organization_id?: string | null
}

function parseLimit(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 50
  return Math.min(Math.max(Math.trunc(n), 1), 500)
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const cronSecret = process.env.LEAD_REDISTRIBUTION_CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const isCronRequest = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)

  let body: ProcessBody = {}
  try {
    body = (await req.json()) as ProcessBody
  } catch {
    // Body is optional.
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
      .select("organization_id, role")
      .eq("id", user.id)
      .single()

    const role = (profile?.role as string | null) ?? null
    const canManage = role === "owner" || role === "manager"
    if (!canManage || !profile?.organization_id) return new NextResponse("Forbidden", { status: 403 })

    organizationId = profile.organization_id
  }

  const { data, error } = await supabase.rpc("lead_redistribute_overdue", {
    p_limit: limit,
    p_org_id: organizationId,
  })

  if (error) {
    return NextResponse.json({ ok: false, message: error.message, code: error.code }, { status: 500 })
  }

  return NextResponse.json({ ok: true, result: data })
}
