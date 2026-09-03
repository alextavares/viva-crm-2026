import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { deriveImovelwebEventId } from "@/lib/integrations/imovelweb-webhook"

export const dynamic = "force-dynamic"

type ImovelwebIngestResult = {
  accepted: boolean
  deduped: boolean
  reference: string
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function castStr(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v)
}

function firstStr(payload: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = castStr(payload[k]).trim()
    if (v) return v
  }
  return ""
}

/**
 * Webhook receiver for Imovelweb leads.
 * URL: POST /api/public/webhooks/[slug]/imovelweb?secret=<webhook-secret>
 * (`token` is accepted as an alias for the secret query param.)
 *
 * Canonical boundary: the presented secret is verified server-side by
 * `api.imovelweb_ingest` against `private.integration_credentials`
 * (provider `imovelweb`, purpose `webhook_auth`). This route never reads
 * secrets from `portal_integrations.config` (forbidden by the canonical
 * contract) and never logs raw payloads/PII.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const supabase = serviceClient()
  if (!supabase) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  try {
    const { slug } = await params
    const url = new URL(request.url)
    const secret = url.searchParams.get("secret") ?? url.searchParams.get("token") ?? ""

    if (!slug || !secret) {
      return NextResponse.json({ error: "Missing slug or secret" }, { status: 401 })
    }

    let payload: Record<string, unknown>
    try {
      payload = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }

    const name = firstStr(payload, ["name", "nome", "firstName"]).slice(0, 120) || "Lead Imovelweb"
    const phone = firstStr(payload, ["phone", "telefone", "celular", "whatsapp"]).slice(0, 32)
    const email = firstStr(payload, ["email", "mail"]).slice(0, 254)
    const message = firstStr(payload, ["message", "mensagem", "observacao"]).slice(0, 2000)
    const listingRef = firstStr(payload, ["listingId", "id_imovel", "codigo_imovel", "imovel"]).slice(0, 200)
    const phoneNorm = phone.replace(/[^0-9+]/g, "").slice(0, 32)

    if (phoneNorm.length < 8 || phoneNorm.length > 16) {
      return NextResponse.json({ error: "Missing phone number in payload" }, { status: 400 })
    }

    const eventId = deriveImovelwebEventId({
      eventId: firstStr(payload, ["event_id", "eventId", "id", "lead_id", "leadId"]).slice(0, 200),
      phoneNorm,
      listingRef,
      message: message.slice(0, 200),
    })

    const { data, error } = await supabase.rpc("imovelweb_ingest", {
      p_slug: slug,
      p_webhook_secret: secret,
      p_event_id: eventId,
      p_name: name,
      p_phone: phone,
      p_email: email || null,
      p_message: message || null,
      p_listing_ref: listingRef || null,
      p_received_at: new Date().toISOString(),
    })

    if (error) {
      const msg = error.message ?? ""
      if (msg.includes("invalid webhook credential")) {
        return NextResponse.json({ error: "Invalid credential" }, { status: 403 })
      }
      if (msg.includes("invalid bounded webhook payload")) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
      }
      // eslint-disable-next-line no-console
      console.error("[Webhook Imovelweb] ingest failed")
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }

    const result = data as ImovelwebIngestResult
    return NextResponse.json(
      { success: true, accepted: result.accepted, deduped: result.deduped, reference: result.reference },
      { status: 200 }
    )
  } catch {
    // eslint-disable-next-line no-console
    console.error("[Webhook Imovelweb] unhandled error")
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

