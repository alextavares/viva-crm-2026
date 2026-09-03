import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { loadAiLeadReengagementSettings } from "@/lib/ai-leads/reengagement"
import { Button } from "@/components/ui/button"
import { WhatsAppAddonPricingForm } from "@/components/whatsapp-addon/whatsapp-addon-pricing-form"
import { AiReengagementSettingsForm } from "@/components/ai-leads/ai-reengagement-settings-form"
import type { WhatsAppAddonUsageSnapshot } from "@/lib/types"

type WhatsAppAddonPricingRow = {
  organization_id: string
  addon_enabled: boolean
  included_quota: number
  overage_price: number
  currency_code: string
  billing_timezone: string
}

type AiReengagementSettingsRow = {
  organization_id: string
  enabled: boolean
  first_delay_minutes: number
  second_delay_minutes: number
  third_delay_minutes: number
  inactive_message_template: string
  handoff_message_template: string
  sla_minutes: number
  final_escalation_delay_minutes: number
  notify_broker: boolean
  notify_manager: boolean
}

const DEFAULTS: Omit<WhatsAppAddonPricingRow, "organization_id"> = {
  addon_enabled: false,
  included_quota: 0,
  overage_price: 0,
  currency_code: "BRL",
  billing_timezone: "America/Sao_Paulo",
}

const AI_REENGAGEMENT_DEFAULTS: Omit<AiReengagementSettingsRow, "organization_id"> = {
  enabled: false,
  first_delay_minutes: 15,
  second_delay_minutes: 120,
  third_delay_minutes: 1440,
  inactive_message_template:
    "Olá {{first_name}}, seguimos por aqui para te ajudar com sua busca. Se quiser, posso retomar seu atendimento agora.",
  handoff_message_template:
    "Olá {{first_name}}, seu atendimento segue em andamento por aqui. Se quiser continuar agora, me responda nesta conversa.",
  sla_minutes: 30,
  final_escalation_delay_minutes: 30,
  notify_broker: true,
  notify_manager: true,
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

  // Canonical settings source: `ai_lead_settings` (delays/flags) plus
  // `message_templates` (copy). See loadAiLeadReengagementSettings.
  const { settings: aiReengagementSettings } = await loadAiLeadReengagementSettings(supabase, organizationId)
  const aiReengagementReady = true

  const initialAiReengagement: AiReengagementSettingsRow = {
    organization_id: organizationId,
    enabled: aiReengagementSettings.enabled,
    first_delay_minutes: aiReengagementSettings.firstDelayMinutes,
    second_delay_minutes: aiReengagementSettings.secondDelayMinutes,
    third_delay_minutes: aiReengagementSettings.thirdDelayMinutes,
    inactive_message_template: aiReengagementSettings.inactiveMessageTemplate,
    handoff_message_template: aiReengagementSettings.handoffMessageTemplate,
    sla_minutes: aiReengagementSettings.slaMinutes,
    final_escalation_delay_minutes: aiReengagementSettings.finalEscalationDelayMinutes,
    notify_broker: aiReengagementSettings.notifyBroker,
    notify_manager: aiReengagementSettings.notifyManager,
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

      <div className="rounded-lg border bg-muted/10 p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Cadência de retomada IA</h2>
          <p className="text-sm text-muted-foreground">
            Define as tentativas automáticas de retomada e o escalonamento interno quando o lead some
            ou quando o handoff fica parado.
          </p>
        </div>

        <AiReengagementSettingsForm
          canManage={isAdmin}
          tableReady={aiReengagementReady}
          initial={initialAiReengagement}
        />
      </div>
    </div>
  )
}
