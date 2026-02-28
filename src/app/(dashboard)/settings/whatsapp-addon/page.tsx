import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { WhatsAppAddonPricingForm } from "@/components/whatsapp-addon/whatsapp-addon-pricing-form"
import type { WhatsAppAddonUsageSnapshot } from "@/lib/types"

type WhatsAppAddonPricingRow = {
  organization_id: string
  addon_enabled: boolean
  included_quota: number
  overage_price: number
  currency_code: string
  billing_timezone: string
}

const DEFAULTS: Omit<WhatsAppAddonPricingRow, "organization_id"> = {
  addon_enabled: false,
  included_quota: 0,
  overage_price: 0,
  currency_code: "BRL",
  billing_timezone: "America/Sao_Paulo",
}

export default async function WhatsAppAddonSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">WhatsApp Add-on</h1>
        <p className="text-muted-foreground">Faça login para continuar.</p>
      </div>
    )
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  const organizationId = profile?.organization_id ?? null
  const role = (profile?.role as string | null) ?? null
  const isAdmin = role === "owner" || role === "manager"

  if (!organizationId) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">WhatsApp Add-on</h1>
        <p className="text-muted-foreground">Organização não encontrada para este usuário.</p>
      </div>
    )
  }

  const { data, error } = await supabase
    .from("whatsapp_addon_pricing_settings")
    .select("organization_id, addon_enabled, included_quota, overage_price, currency_code, billing_timezone")
    .eq("organization_id", organizationId)
    .maybeSingle()

  const tableReady = !error || !["42P01", "42703"].includes(error.code ?? "")
  let initialUsage: WhatsAppAddonUsageSnapshot | null = null
  let usageReady = false

  if (tableReady) {
    const usageResult = await supabase.rpc("whatsapp_usage_snapshot", { p_organization_id: organizationId })
    usageReady = !usageResult.error || !["42883", "42P01", "42703"].includes(usageResult.error.code ?? "")
    initialUsage = (usageResult.data as WhatsAppAddonUsageSnapshot | null) ?? null
  }

  const initial: WhatsAppAddonPricingRow = {
    organization_id: organizationId,
    addon_enabled: data?.addon_enabled ?? DEFAULTS.addon_enabled,
    included_quota: data?.included_quota ?? DEFAULTS.included_quota,
    overage_price: data?.overage_price ?? DEFAULTS.overage_price,
    currency_code: data?.currency_code ?? DEFAULTS.currency_code,
    billing_timezone: data?.billing_timezone ?? DEFAULTS.billing_timezone,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">WhatsApp Add-on</h1>
          <p className="text-muted-foreground">
            Pricing comercial por organização: ativa/desativa, quota mensal inclusa e valor de excedente.
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-muted/10 p-4">
        <WhatsAppAddonPricingForm
          canManage={isAdmin}
          tableReady={tableReady}
          usageReady={usageReady}
          initial={initial}
          initialUsage={initialUsage}
        />
      </div>
    </div>
  )
}
