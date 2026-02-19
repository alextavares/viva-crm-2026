import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type CollapseBody = {
  collapsed?: unknown
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  let body: CollapseBody
  try {
    body = (await req.json()) as CollapseBody
  } catch {
    return new NextResponse("Bad Request", { status: 400 })
  }

  if (typeof body.collapsed !== "boolean") {
    return new NextResponse("Bad Request", { status: 400 })
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const role = (profile.role as string | null) ?? null
  const isAdmin = role === "owner" || role === "manager"
  if (!isAdmin) return new NextResponse("Forbidden", { status: 403 })

  const { error } = await supabase.from("site_settings").upsert({
    organization_id: profile.organization_id,
    onboarding_collapsed: body.collapsed,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, collapsed: body.collapsed })
}

