import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

/**
 * Public site lead intake.
 * POST /api/public/s/[slug]/lead { name, phone, email?, propertyId?, message? }
 *
 * Canonical boundary: `api.site_create_lead` is granted to `service_role`
 * exclusively, so browser clients submit here instead of calling the RPC with
 * an anon key. The RPC enforces bounded payloads, property availability, and
 * deterministic idempotency via `p_idempotency_key`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  try {
    const { slug } = await params
    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }

    const name = String(body.name ?? "").trim().slice(0, 120)
    const phone = String(body.phone ?? "").trim().slice(0, 32)
    const email = String(body.email ?? "").trim().slice(0, 254) || null
    const propertyId = String(body.propertyId ?? "").trim() || null
    const message = String(body.message ?? "").trim().slice(0, 2000) || null
    const sourceDomain = request.headers.get("host")?.slice(0, 253) ?? null

    if (!name || !phone) {
      return NextResponse.json({ error: "Missing name or phone" }, { status: 400 })
    }

    const supabase = createClient(url, key)
    const idempotencyKey =
      typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim().slice(0, 200)
        : `form-${createHash("sha256").update(`${slug}|${name}|${phone}|${message ?? ""}`).digest("hex").slice(0, 48)}`

    const { data, error } = await supabase.rpc("site_create_lead", {
      p_slug: slug,
      p_name: name,
      p_phone: phone,
      p_email: email,
      p_property_id: propertyId,
      p_message: message,
      p_source_domain: sourceDomain,
      p_idempotency_key: idempotencyKey,
    })

    if (error) {
      return NextResponse.json({ error: "Não foi possível enviar. Verifique os dados e tente novamente." }, { status: 422 })
    }

    const result = data as { accepted: boolean; deduped: boolean; reference: string }
    return NextResponse.json(
      { contact_id: result.reference, deduped: result.deduped },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
