import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const { data, error } = await supabase.rpc("whatsapp_usage_snapshot", {
    p_organization_id: profile.organization_id,
  })

  if (error) {
    const migrationPending = error.code === "42883" || error.code === "42P01" || error.code === "42703"
    return NextResponse.json(
      {
        ok: false,
        message: migrationPending
          ? "Migração pendente para painel de consumo do WhatsApp add-on."
          : error.message,
      },
      { status: migrationPending ? 503 : 500 }
    )
  }

  return NextResponse.json({ ok: true, usage: data ?? null })
}
