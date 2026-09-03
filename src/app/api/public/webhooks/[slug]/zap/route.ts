import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

/**
 * Webhook receiver for Zap/VivaReal leads.
 * URL: POST /api/public/webhooks/[slug]/zap?token=xyz
 *
 * Canonical path: lead creation goes through `api.site_create_lead`
 * (service_role only) with `p_source_domain='zap'`, which enforces bounded
 * payloads, property availability, and deterministic idempotency. Contact
 * dedupe by normalized phone uses the canonical `phone_normalized` column;
 * inbound messages carry `external_message_id` for natural dedupe.
 *
 * CANONICAL CONTRACT GAP: there is no `portal_create_lead`/zap ingest RPC,
 * and portal webhook secrets have no canonical store yet (the contract only
 * provisions `imovelweb` feed/webhook credentials via
 * `api.rotate_integration_credential`). The presented token is therefore still
 * compared against the non-secret `portal_integrations` row for this portal
 * (status `enabled`, canonical; `active` accepted as a legacy bridge), and no
 * new secrets may be written into `config` (forbidden by contract).
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { slug } = await params
    const url = new URL(request.url)
    const token = url.searchParams.get("token")

    if (!slug || !token) {
      return NextResponse.json({ error: "Token missing" }, { status: 401 })
    }

    const { data: orgData, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single()

    if (orgError || !orgData) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 })
    }
    const orgId = orgData.id as string

    const { data: configRows, error: configError } = await supabaseAdmin
      .from("portal_integrations")
      .select("config")
      .eq("organization_id", orgId)
      .eq("portal", "zap_vivareal")
      .in("status", ["enabled", "active"])
      .single()

    if (configError || !configRows) {
      return NextResponse.json({ error: "Portal integration not active" }, { status: 403 })
    }

    const config = configRows.config as Record<string, unknown>
    if (typeof config.feed_token !== "string" || config.feed_token !== token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 403 })
    }

    let payload: Record<string, unknown>
    try {
      payload = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }

    const castStr = (v: unknown) => (v ? String(v) : "")
    const firstStr = (keys: string[]) => {
      for (const k of keys) {
        const v = castStr(payload[k]).trim()
        if (v) return v
      }
      return ""
    }

    const name = firstStr(["name", "nome", "firstName"]).slice(0, 120) || "Lead Zap"
    const phone = firstStr(["phone", "telefone", "celular", "whatsapp"]).slice(0, 32)
    const email = firstStr(["email", "mail"]).slice(0, 254)
    const rawMessage = firstStr(["message", "mensagem", "observacao"]).slice(0, 2000)
    const listingRef = firstStr(["listingId", "id_imovel", "codigo_imovel", "imovel"]).slice(0, 200)
    const phoneNorm = phone.replace(/[^0-9+]/g, "").slice(0, 32)

    if (!phone) {
      return NextResponse.json({ error: "Missing phone number in payload" }, { status: 400 })
    }

    let propertyId: string | null = null
    if (listingRef) {
      const { data: propData } = await supabaseAdmin
        .from("properties")
        .select("id")
        .eq("organization_id", orgId)
        .eq("public_code", listingRef)
        .maybeSingle()
      propertyId = (propData?.id as string | undefined) ?? null
    }

    const explicitEventId = firstStr(["event_id", "eventId", "id", "lead_id", "leadId"]).slice(0, 200)
    const idempotencyKey =
      explicitEventId ||
      `zap-${createHash("sha256").update(`${slug}|${phoneNorm}|${listingRef}|${rawMessage.slice(0, 200)}`).digest("hex").slice(0, 48)}`

    const { data: existingContact } = await supabaseAdmin
      .from("contacts")
      .select("id, email")
      .eq("organization_id", orgId)
      .eq("phone_normalized", phoneNorm || "__missing__")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    let contactId: string
    if (existingContact) {
      contactId = existingContact.id as string
      if (!existingContact.email && email) {
        await supabaseAdmin.from("contacts").update({ email }).eq("id", contactId)
      }
    } else {
      const { data, error } = await supabaseAdmin.rpc("site_create_lead", {
        p_slug: slug,
        p_name: name,
        p_phone: phone,
        p_email: email || null,
        p_property_id: propertyId,
        p_message: rawMessage || null,
        p_source_domain: "zap",
        p_idempotency_key: idempotencyKey,
      })
      if (error || !(data as { reference?: string } | null)) {
        return NextResponse.json({ error: "Error creating contact" }, { status: 500 })
      }
      const result = data as { accepted: boolean; deduped: boolean; reference: string }
      contactId = result.reference
    }

    if (rawMessage) {
      await supabaseAdmin.from("messages").insert({
        organization_id: orgId,
        contact_id: contactId,
        direction: "in",
        channel: "zap",
        body: rawMessage.slice(0, 10000),
        external_message_id: idempotencyKey.slice(0, 200),
      })
    }

    await supabaseAdmin
      .from("portal_integrations")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("portal", "zap_vivareal")

    return NextResponse.json(
      { success: true, result: { contact_id: contactId, message_inserted: Boolean(rawMessage) } },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
