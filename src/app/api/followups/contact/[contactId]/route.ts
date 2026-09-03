import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { applyContactFollowupActionForOrganization } from "@/lib/followups/operations"

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

  const result = await applyContactFollowupActionForOrganization(supabase, organizationId, contactId, body.action)
  if (!result.success) {
    const status = result.error.includes("não encontrado") ? 404 : 500
    return NextResponse.json({ ok: false, message: result.error }, { status })
  }

  return NextResponse.json({ ok: true, ...result.data })
}

