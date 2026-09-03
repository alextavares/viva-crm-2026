import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { processAiLeadReengagementsForOrganization } from "@/lib/ai-leads/reengagement"

type ProcessBody = {
  limit?: number
  organization_id?: string | null
}

function parseLimit(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 100
  return Math.min(Math.max(Math.trunc(n), 1), 500)
}

export async function POST(req: Request) {
  const authSupabase = await createClient()
  const admin = createAdminClient()
  const cronSecret = process.env.AI_REENGAGEMENT_CRON_SECRET || process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization")
  const isCronRequest = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)

  let body: ProcessBody = {}
  try {
    body = (await req.json()) as ProcessBody
  } catch {
    // optional body
  }

  const limit = parseLimit(body.limit)
  let organizationId = body.organization_id ?? null

  if (!isCronRequest) {
    const {
      data: { user },
    } = await authSupabase.auth.getUser()
    if (!user) return new NextResponse("Unauthorized", { status: 401 })

    const { data: profile } = await authSupabase
      .from("profiles")
      .select("organization_id, role")
      .eq("id", user.id)
      .single()

    const role = (profile?.role as string | null) ?? null
    const canManage = role === "owner" || role === "manager"
    if (!canManage || !profile?.organization_id) {
      return new NextResponse("Forbidden", { status: 403 })
    }

    organizationId = profile.organization_id
  }

  if (!organizationId) {
    return NextResponse.json(
      { ok: false, message: "organization_id é obrigatório para processar a retomada IA." },
      { status: 400 }
    )
  }

  const result = await processAiLeadReengagementsForOrganization(admin, organizationId, limit)
  if (!result.success) {
    return NextResponse.json({ ok: false, message: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, result: result.data })
}
