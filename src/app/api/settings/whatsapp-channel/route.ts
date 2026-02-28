import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Body = {
  provider?: "meta"
  operation_mode?: "live" | "sandbox"
  display_phone?: string
  business_account_id?: string
  phone_number_id?: string
  webhook_verify_token?: string
  access_token?: string
}

function normalizeText(value: unknown, maxLen = 255) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

function tokenLast4(token: string | null) {
  if (!token) return null
  return token.slice(-4)
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
        message: "Ative o add-on WhatsApp primeiro em Configurações > WhatsApp Add-on.",
      },
      { status: 409 }
    )
  }

  const provider = body.provider === "meta" ? "meta" : "meta"
  const operationMode = body.operation_mode === "sandbox" ? "sandbox" : "live"
  const displayPhone = normalizeText(body.display_phone, 60)
  const businessAccountId = normalizeText(body.business_account_id, 120)
  const phoneNumberId = normalizeText(body.phone_number_id, 120)
  const webhookVerifyToken = normalizeText(body.webhook_verify_token, 255)
  const accessToken = normalizeText(body.access_token, 2048)

  const { data: existing, error: existingError } = await supabase
    .from("whatsapp_channel_settings")
    .select("access_token, status")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ ok: false, message: existingError.message }, { status: 500 })
  }

  const finalToken = accessToken ?? existing?.access_token ?? null
  const finalStatus = existing?.status ?? "disconnected"

  const payload = {
    organization_id: organizationId,
    provider,
    operation_mode: operationMode,
    display_phone: displayPhone,
    business_account_id: businessAccountId,
    phone_number_id: phoneNumberId,
    webhook_verify_token: webhookVerifyToken,
    access_token: finalToken,
    access_token_last4: tokenLast4(finalToken),
    status: finalStatus,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("whatsapp_channel_settings").upsert(payload)
  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  if (webhookVerifyToken) {
    const { data: existingEndpoint, error: endpointLookupError } = await supabase
      .from("webhook_endpoints")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("source", "whatsapp_inbound")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (endpointLookupError) {
      return NextResponse.json({ ok: false, message: endpointLookupError.message }, { status: 500 })
    }

    if (existingEndpoint?.id) {
      const { error: endpointUpdateError } = await supabase
        .from("webhook_endpoints")
        .update({
          token: webhookVerifyToken,
          is_active: true,
        })
        .eq("id", existingEndpoint.id)

      if (endpointUpdateError) {
        return NextResponse.json({ ok: false, message: endpointUpdateError.message }, { status: 500 })
      }
    } else {
      const { error: endpointInsertError } = await supabase.from("webhook_endpoints").insert({
        organization_id: organizationId,
        token: webhookVerifyToken,
        source: "whatsapp_inbound",
        is_active: true,
      })

      if (endpointInsertError) {
        return NextResponse.json({ ok: false, message: endpointInsertError.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    channel: {
      provider,
      operation_mode: operationMode,
      display_phone: displayPhone,
      business_account_id: businessAccountId,
      phone_number_id: phoneNumberId,
      webhook_verify_token: webhookVerifyToken,
      has_access_token: Boolean(finalToken),
      access_token_last4: tokenLast4(finalToken),
    },
  })
}
