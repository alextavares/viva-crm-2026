import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

type Body = {
  addon_enabled?: boolean
  included_quota?: number
  overage_price?: number
  currency_code?: string
  billing_timezone?: string
}

function toInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

function toDecimal(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const clamped = Math.min(max, Math.max(min, parsed))
  return Number(clamped.toFixed(4))
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

  if (profileError || !profile?.organization_id) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const role = (profile.role as string | null) ?? null
  const canManage = role === "owner" || role === "manager"
  if (!canManage) return new NextResponse("Forbidden", { status: 403 })

  const organizationId = profile.organization_id as string
  const includedQuota = toInt(body.included_quota, 0, 0, 1000000)
  const overagePrice = toDecimal(body.overage_price, 0, 0, 999999)
  const currencyCode = (body.currency_code || "BRL").trim().toUpperCase()
  const billingTimezone = (body.billing_timezone || "America/Sao_Paulo").trim()

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return NextResponse.json({ ok: false, message: "currency_code inválido" }, { status: 400 })
  }
  if (!billingTimezone || billingTimezone.length > 80) {
    return NextResponse.json({ ok: false, message: "billing_timezone inválido" }, { status: 400 })
  }

  const { error } = await supabase.from("whatsapp_addon_pricing_settings").upsert({
    organization_id: organizationId,
    addon_enabled: Boolean(body.addon_enabled),
    included_quota: includedQuota,
    overage_price: overagePrice,
    currency_code: currencyCode,
    billing_timezone: billingTimezone,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    settings: {
      addon_enabled: Boolean(body.addon_enabled),
      included_quota: includedQuota,
      overage_price: overagePrice,
      currency_code: currencyCode,
      billing_timezone: billingTimezone,
    },
  })
}
