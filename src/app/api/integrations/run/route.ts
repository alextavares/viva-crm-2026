import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PORTALS, type PortalKey } from "@/lib/integrations"

type Body = {
  portal: string
  status: "ok" | "error"
  properties_count: number
  bytes: number
  content_type: string | null
  message: string | null
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

  const portal = body.portal
  if (!PORTALS.includes(portal as PortalKey)) {
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

  await supabase.from("portal_integration_runs").insert({
    organization_id: organizationId,
    portal,
    kind: "test_feed",
    status: body.status,
    properties_count: Math.max(0, Number(body.properties_count) || 0),
    bytes: Math.max(0, Number(body.bytes) || 0),
    content_type: body.content_type,
    message: body.message,
  })

  return NextResponse.json({ ok: true })
}

