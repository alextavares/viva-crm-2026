import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { WhatsAppChannelForm } from "@/components/whatsapp-addon/whatsapp-channel-form"

type ChannelSettingsRow = {
  provider: "meta"
  operation_mode: "live" | "sandbox"
  display_phone: string | null
  business_account_id: string | null
  phone_number_id: string | null
  webhook_verify_token: string | null
  access_token_last4: string | null
  status: "disconnected" | "connected" | "error"
  last_error_message: string | null
  last_tested_at: string | null
}

const DEFAULTS: ChannelSettingsRow = {
  provider: "meta",
  operation_mode: "live",
  display_phone: null,
  business_account_id: null,
  phone_number_id: null,
  webhook_verify_token: null,
  access_token_last4: null,
  status: "disconnected",
  last_error_message: null,
  last_tested_at: null,
}

export default async function WhatsAppChannelSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">Canal WhatsApp Oficial</h1>
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
        <h1 className="text-lg font-semibold md:text-2xl">Canal WhatsApp Oficial</h1>
        <p className="text-muted-foreground">Organização não encontrada para este usuário.</p>
      </div>
    )
  }

  const [addonResult, channelResult, webhookResult] = await Promise.all([
    supabase
      .from("whatsapp_addon_pricing_settings")
      .select("addon_enabled")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("whatsapp_channel_settings")
      .select(
        "provider, operation_mode, display_phone, business_account_id, phone_number_id, webhook_verify_token, access_token_last4, status, last_error_message, last_tested_at"
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("webhook_endpoints")
      .select("token")
      .eq("organization_id", organizationId)
      .eq("source", "whatsapp_inbound")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const addonTableReady = !addonResult.error || addonResult.error.code !== "42P01"
  const channelTableReady = !channelResult.error || channelResult.error.code !== "42P01"
  const tableReady = addonTableReady && channelTableReady

  const addonEnabled = addonTableReady ? Boolean(addonResult.data?.addon_enabled) : false

  const initial: ChannelSettingsRow = {
    provider: (channelResult.data?.provider as "meta" | undefined) ?? DEFAULTS.provider,
    operation_mode: (channelResult.data?.operation_mode as "live" | "sandbox" | undefined) ?? DEFAULTS.operation_mode,
    display_phone: channelResult.data?.display_phone ?? DEFAULTS.display_phone,
    business_account_id: channelResult.data?.business_account_id ?? DEFAULTS.business_account_id,
    phone_number_id: channelResult.data?.phone_number_id ?? DEFAULTS.phone_number_id,
    webhook_verify_token: channelResult.data?.webhook_verify_token ?? DEFAULTS.webhook_verify_token,
    access_token_last4: channelResult.data?.access_token_last4 ?? DEFAULTS.access_token_last4,
    status: (channelResult.data?.status as "disconnected" | "connected" | "error" | undefined) ?? DEFAULTS.status,
    last_error_message: channelResult.data?.last_error_message ?? DEFAULTS.last_error_message,
    last_tested_at: channelResult.data?.last_tested_at ?? DEFAULTS.last_tested_at,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Canal WhatsApp Oficial</h1>
          <p className="text-muted-foreground">
            Configure o canal Meta por organização. Credenciais ficam isoladas por tenant e sem exposição de segredo.
          </p>
        </div>
        <Link href="/settings">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      {!addonTableReady ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Migração pendente: execute primeiro a migration de pricing do add-on WhatsApp.
        </div>
      ) : null}

      <div className="rounded-lg border bg-muted/10 p-4">
        <WhatsAppChannelForm
          canManage={isAdmin}
          tableReady={tableReady}
          addonEnabled={addonEnabled}
          initial={initial}
          webhookToken={webhookResult.error ? null : webhookResult.data?.token ?? null}
        />
      </div>
    </div>
  )
}
