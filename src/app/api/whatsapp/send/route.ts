import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { waMeNumberFromPhone } from "@/lib/whatsapp"
import { fetchWithTimeout } from "@/lib/supabase/fetch-timeout"

type Body = {
  contact_id?: string
  message?: string
}

type ChannelRow = {
  provider: "meta"
  operation_mode: "live" | "sandbox"
  phone_number_id: string | null
  access_token: string | null
  status: "disconnected" | "connected" | "error"
}

type PolicyResult = {
  allowed?: boolean
  reason?: string
  message?: string
  balance?: number
  consumed_count?: number
  included_quota?: number
}

const metaFetch = fetchWithTimeout(15000)

function normalizeMessage(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 4096)
}

function normalizeText(value: string | null | undefined, maxLen = 255) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
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

  const contactId = normalizeText(body.contact_id, 64)
  const message = normalizeMessage(body.message)
  if (!contactId || !message) {
    return NextResponse.json(
      { ok: false, message: "Informe contact_id e message." },
      { status: 400 }
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (profileError || !profile?.organization_id) return new NextResponse("Forbidden", { status: 403 })

  const role = (profile.role as string | null) ?? null
  if (role !== "owner" && role !== "manager") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const organizationId = profile.organization_id as string

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, name, phone")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (contactError) {
    return NextResponse.json({ ok: false, message: contactError.message }, { status: 500 })
  }
  if (!contact) {
    return NextResponse.json({ ok: false, message: "Contato não encontrado." }, { status: 404 })
  }

  const to = waMeNumberFromPhone(contact.phone || "")
  if (!to) {
    return NextResponse.json(
      {
        ok: false,
        message: "Contato sem telefone válido para WhatsApp.",
      },
      { status: 409 }
    )
  }

  const { data: channelData, error: channelError } = await supabase
    .from("whatsapp_channel_settings")
    .select("provider, operation_mode, phone_number_id, access_token, status")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (channelError) {
    return NextResponse.json({ ok: false, message: channelError.message }, { status: 500 })
  }
  if (!channelData) {
    return NextResponse.json(
      { ok: false, message: "Canal WhatsApp não configurado." },
      { status: 409 }
    )
  }

  const channel = channelData as ChannelRow
  const isSandbox = channel.operation_mode === "sandbox"
  const phoneNumberId = normalizeText(channel.phone_number_id, 120)
  const accessToken = normalizeText(channel.access_token, 4096)

  if (!isSandbox && (channel.status !== "connected" || !phoneNumberId || !accessToken)) {
    return NextResponse.json(
      { ok: false, message: "Canal WhatsApp não está conectado." },
      { status: 409 }
    )
  }

  const { data: policyData, error: policyError } = await supabase.rpc("whatsapp_send_policy_check", {
    p_organization_id: organizationId,
    p_units: 1,
  })

  if (policyError) {
    return NextResponse.json({ ok: false, message: policyError.message }, { status: 500 })
  }

  const policy = (policyData || {}) as PolicyResult
  if (!policy.allowed) {
    const blockedMessage =
      normalizeText(policy.message, 500) ||
      "Envio oficial bloqueado por política comercial."

    await supabase.from("contact_events").insert({
      organization_id: organizationId,
      contact_id: contactId,
      type: "whatsapp_policy_blocked",
      source: "whatsapp_api",
      payload: {
        reason: policy.reason || "blocked",
        message: blockedMessage,
        policy,
      },
    })

    return NextResponse.json(
      {
        ok: false,
        reason: policy.reason || "blocked",
        message: blockedMessage,
        policy,
      },
      { status: 409 }
    )
  }

  let providerMessageId: string | null = null
  let providerName = "meta"

  if (!isSandbox) {
    const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || "v20.0"
    const graphUrl = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`

    let metaPayload: unknown
    try {
      const metaResponse = await metaFetch(graphUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: {
            preview_url: false,
            body: message,
          },
        }),
      })

      metaPayload = await metaResponse.json().catch(() => ({}))

      if (!metaResponse.ok) {
        const metaErrorMessage =
          (metaPayload as { error?: { message?: string } })?.error?.message ||
          `Meta Graph error (${metaResponse.status})`
        return NextResponse.json(
          { ok: false, message: metaErrorMessage, provider: "meta", details: metaPayload },
          { status: 502 }
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na chamada ao provedor."
      return NextResponse.json(
        { ok: false, message, provider: "meta" },
        { status: 502 }
      )
    }

    providerMessageId =
      (metaPayload as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id || null
  } else {
    providerName = "sandbox"
    providerMessageId = `sandbox-${Date.now()}`
  }

  const { data: insertedMessage, error: insertError } = await supabase
    .from("messages")
    .insert({
      organization_id: organizationId,
      contact_id: contactId,
      direction: "out",
      channel: isSandbox ? "whatsapp_official_sandbox" : "whatsapp_official",
      body: message,
    })
    .select("id")
    .single()

  if (insertError) {
    return NextResponse.json({ ok: false, message: insertError.message }, { status: 500 })
  }

  await supabase.from("contact_events").insert({
    organization_id: organizationId,
    contact_id: contactId,
    type: "note_added",
    source: "whatsapp_api",
    payload: {
      message_id: insertedMessage.id,
      provider: providerName,
      provider_message_id: providerMessageId,
      operation_mode: isSandbox ? "sandbox" : "live",
      policy,
    },
  })

  return NextResponse.json({
    ok: true,
    message_id: insertedMessage.id,
    provider: providerName,
    provider_message_id: providerMessageId,
    mode: isSandbox ? "sandbox" : "live",
    policy,
  })
}
