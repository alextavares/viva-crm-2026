import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { normalizeWhatsAppWebhookPayload } from "@/lib/whatsapp-webhook-normalizer"

type RpcResult = {
  contact_id: string
}

function getSupabasePublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return new NextResponse("Not found", { status: 404 })

  const url = new URL(req.url)
  const mode = url.searchParams.get("hub.mode")
  const challenge = url.searchParams.get("hub.challenge")
  const verifyToken = url.searchParams.get("hub.verify_token")

  if (mode === "subscribe" && challenge && verifyToken === token) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse("Forbidden", { status: 403 })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token) return new NextResponse("Not found", { status: 404 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return new NextResponse("Bad Request", { status: 400 })
  }

  const providerHint = new URL(req.url).searchParams.get("provider")
  const normalized = normalizeWhatsAppWebhookPayload(body, providerHint)

  if (normalized.leads.length === 0) {
    return NextResponse.json({
      ok: true,
      received: 0,
      ingested: 0,
      skipped: normalized.skipped,
    })
  }

  const supabase = getSupabasePublicClient()
  if (!supabase) return new NextResponse("Server misconfigured", { status: 500 })

  let ingested = 0
  const contactIds: string[] = []
  for (const lead of normalized.leads) {
    const { data, error } = await supabase.rpc("webhook_ingest_lead", {
      p_token: token,
      p_source: null,
      p_external_id: lead.external_id,
      p_name: lead.name,
      p_phone: lead.phone,
      p_email: null,
      p_message: lead.message,
      p_property_id: null,
    })

    if (error) {
      const code = (error as { code?: string }).code ?? ""
      if (code === "22023") continue
      if (code === "42501") return new NextResponse("Forbidden", { status: 403 })
      return new NextResponse("Internal Server Error", { status: 500 })
    }

    if (!data) return new NextResponse("Not found", { status: 404 })

    const result = data as unknown as RpcResult
    if (result.contact_id) {
      ingested += 1
      contactIds.push(result.contact_id)
    }
  }

  return NextResponse.json({
    ok: true,
    received: normalized.leads.length,
    ingested,
    skipped: normalized.skipped,
    contacts: Array.from(new Set(contactIds)),
  })
}

