import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  safeParseWebhookLeadPayload,
  type WebhookIngestResult,
} from "@/lib/inbox"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return new NextResponse("Not found", { status: 404 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return new NextResponse("Server misconfigured", { status: 500 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new NextResponse("Bad Request", { status: 400 })
  }

  const parsed = safeParseWebhookLeadPayload(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const supabase = createClient(url, key)
  const { data, error } = await supabase.rpc("webhook_ingest_lead", {
    p_token: token,
    p_source: parsed.data.source ?? null,
    p_external_id: parsed.data.external_id ?? null,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_email: parsed.data.email ?? null,
    p_message: parsed.data.message ?? null,
    p_property_id: parsed.data.property_id ?? null,
  })

  if (error) {
    // Token exists but source mismatch / invalid input, etc.
    const code = (error as { code?: string }).code ?? ""
    if (code === "22023") {
      return new NextResponse("Bad Request", { status: 400 })
    }
    if (code === "42501") {
      return new NextResponse("Forbidden", { status: 403 })
    }
    return new NextResponse("Internal Server Error", { status: 500 })
  }

  if (!data) {
    // Invalid or inactive token.
    return new NextResponse("Not found", { status: 404 })
  }

  const result = data as unknown as WebhookIngestResult
  return NextResponse.json({ contact_id: result.contact_id })
}
