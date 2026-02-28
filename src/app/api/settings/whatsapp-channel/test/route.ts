import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type ChannelRow = {
  organization_id: string
  provider: "meta"
  operation_mode: "live" | "sandbox"
  business_account_id: string | null
  phone_number_id: string | null
  webhook_verify_token: string | null
  access_token: string | null
}

function hasMinLength(value: string | null | undefined, min: number) {
  return typeof value === "string" && value.trim().length >= min
}

export async function POST() {
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

  const { data: addon } = await supabase
    .from("whatsapp_addon_pricing_settings")
    .select("addon_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!addon?.addon_enabled) {
    return NextResponse.json(
      {
        ok: false,
        status: "disconnected",
        message: "Ative o add-on WhatsApp antes de testar a conexão.",
      },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from("whatsapp_channel_settings")
    .select("organization_id, provider, operation_mode, business_account_id, phone_number_id, webhook_verify_token, access_token")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json(
      {
        ok: false,
        status: "disconnected",
        message: "Salve os dados do canal antes de testar.",
      },
      { status: 400 }
    )
  }

  const channel = data as ChannelRow
  const nowIso = new Date().toISOString()

  if (channel.operation_mode === "sandbox") {
    await supabase
      .from("whatsapp_channel_settings")
      .update({
        status: "connected",
        last_error_message: null,
        last_tested_at: nowIso,
        updated_at: nowIso,
      })
      .eq("organization_id", organizationId)

    return NextResponse.json({
      ok: true,
      status: "connected",
      message: "Sandbox ativo. O CRM vai simular envios e registrar os eventos localmente.",
    })
  }

  const missingFields: string[] = []
  if (!hasMinLength(channel.business_account_id, 3)) missingFields.push("Business Account ID")
  if (!hasMinLength(channel.phone_number_id, 3)) missingFields.push("Phone Number ID")
  if (!hasMinLength(channel.webhook_verify_token, 6)) missingFields.push("Webhook Verify Token")
  if (!hasMinLength(channel.access_token, 20)) missingFields.push("Access Token")
  if (missingFields.length > 0) {
    const message = `Configuração incompleta: preencha ${missingFields.join(", ")}.`
    await supabase
      .from("whatsapp_channel_settings")
      .update({
        status: "error",
        last_error_message: message,
        last_tested_at: nowIso,
        updated_at: nowIso,
      })
      .eq("organization_id", organizationId)

    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message,
      },
      { status: 400 }
    )
  }

  await supabase
    .from("whatsapp_channel_settings")
    .update({
      status: "connected",
      last_error_message: null,
      last_tested_at: nowIso,
      updated_at: nowIso,
    })
    .eq("organization_id", organizationId)

  return NextResponse.json({
    ok: true,
    status: "connected",
    message: "Conexão validada com sucesso. Canal pronto para uso.",
  })
}
