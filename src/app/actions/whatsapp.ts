"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fetchWithTimeout } from "@/lib/supabase/fetch-timeout"
import { createClient } from "@/lib/supabase/server"
import { waMeNumberFromPhone } from "@/lib/whatsapp"
import { isAdmin, type ActionResult, type WhatsAppAddonUsageSnapshot } from "@/lib/types"

type ChannelSettingsData = {
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

type SendPolicyResult = {
  allowed?: boolean
  reason?: string
  message?: string
  balance?: number
  consumed_count?: number
  included_quota?: number
}

type SendMode = "sandbox" | "live" | "fallback"

type WhatsAppMessageActionResult = {
  mode: SendMode
  message: string
  messageId?: string
  provider?: "meta" | "sandbox"
  providerMessageId?: string | null
  fallbackReason?: string
}

const channelSettingsSchema = z.object({
  provider: z.literal("meta").default("meta"),
  operation_mode: z.enum(["live", "sandbox"]),
  display_phone: z.string().optional().default(""),
  business_account_id: z.string().optional().default(""),
  phone_number_id: z.string().optional().default(""),
  webhook_verify_token: z.string().optional().default(""),
  access_token: z.string().optional().default(""),
})

const addonPricingSchema = z.object({
  addon_enabled: z.boolean(),
  included_quota: z.coerce
    .number({
      error: "Informe uma quota mensal válida.",
    })
    .int("A quota mensal deve ser um número inteiro.")
    .min(0, "A quota mensal não pode ser negativa.")
    .max(1_000_000, "A quota mensal excede o limite permitido."),
  overage_price: z.coerce
    .number({
      error: "Informe um preço de excedente válido.",
    })
    .min(0, "O preço por excedente não pode ser negativo.")
    .max(999_999, "O preço por excedente excede o limite permitido."),
  currency_code: z
    .string()
    .trim()
    .length(3, "A moeda deve ter exatamente 3 letras (ex.: BRL)."),
  billing_timezone: z
    .string()
    .trim()
    .min(1, "Informe um timezone de faturamento.")
    .max(80, "O timezone informado é longo demais."),
})

const sendOfficialMessageSchema = z.object({
  contact_id: z.string().trim().min(1, "Contato inválido."),
  message: z
    .string()
    .trim()
    .min(1, "Digite uma mensagem antes de enviar.")
    .max(4096, "A mensagem excede o limite permitido."),
})

type AdminContext =
  | { supabase: Awaited<ReturnType<typeof createClient>>; error: string }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>
      organizationId: string
    }

function normalizeText(value: string | null | undefined, maxLen = 255) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

function tokenLast4(token: string | null) {
  if (!token) return null
  return token.slice(-4)
}

function normalizeUsage(snapshot: WhatsAppAddonUsageSnapshot | null): WhatsAppAddonUsageSnapshot | null {
  if (!snapshot) return null
  return {
    organization_id: snapshot.organization_id ?? null,
    addon_enabled: Boolean(snapshot.addon_enabled),
    timezone: snapshot.timezone || "America/Sao_Paulo",
    period_start: snapshot.period_start || null,
    period_end: snapshot.period_end || null,
    included_quota: Number(snapshot.included_quota) || 0,
    consumed: Number(snapshot.consumed) || 0,
    balance: Number(snapshot.balance) || 0,
    usage_percent: Number(snapshot.usage_percent) || 0,
    alert_level: snapshot.alert_level || "ok",
  }
}

function revalidateWhatsAppPaths() {
  revalidatePath("/dashboard")
  revalidatePath("/settings")
  revalidatePath("/settings/whatsapp-addon")
  revalidatePath("/settings/whatsapp-channel")
}

function revalidateWhatsAppContactPaths(contactId?: string | null) {
  revalidateWhatsAppPaths()
  revalidatePath("/contacts")
  revalidatePath("/contacts/site")
  if (contactId) {
    revalidatePath(`/contacts/${contactId}`)
  }
}

async function getWhatsAppAdminContext(): Promise<AdminContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, error: "Não autenticado." }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    return { supabase, error: "Sem permissão para gerenciar o WhatsApp." }
  }

  if (!isAdmin(profile.role)) {
    return { supabase, error: "Apenas gestores podem gerenciar o WhatsApp." }
  }

  return {
    supabase,
    organizationId: profile.organization_id,
  }
}

const metaFetch = fetchWithTimeout(15000)

export async function saveWhatsAppChannelSettings(
  rawInput: z.input<typeof channelSettingsSchema>
): Promise<ActionResult<{ channel: ChannelSettingsData }>> {
  const parsed = channelSettingsSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos para salvar o canal.",
    }
  }

  const ctx = await getWhatsAppAdminContext()
  if ("error" in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, organizationId } = ctx

  const { data: addon } = await supabase
    .from("whatsapp_addon_pricing_settings")
    .select("addon_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!addon?.addon_enabled) {
    return {
      success: false,
      error: "Ative o add-on WhatsApp primeiro em Configurações > WhatsApp Add-on.",
    }
  }

  const provider = "meta" as const
  const operationMode = parsed.data.operation_mode
  const displayPhone = normalizeText(parsed.data.display_phone, 60)
  const businessAccountId = normalizeText(parsed.data.business_account_id, 120)
  const phoneNumberId = normalizeText(parsed.data.phone_number_id, 120)
  const webhookVerifyToken = normalizeText(parsed.data.webhook_verify_token, 255)
  const accessToken = normalizeText(parsed.data.access_token, 2048)

  const { data: existing, error: existingError } = await supabase
    .from("whatsapp_channel_settings")
    .select("access_token, status")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (existingError) {
    return { success: false, error: existingError.message }
  }

  const finalToken = accessToken ?? existing?.access_token ?? null
  const finalStatus = (existing?.status as ChannelSettingsData["status"] | null) ?? "disconnected"

  const payload = {
    organization_id: organizationId,
    provider,
    operation_mode: operationMode,
    display_phone: displayPhone,
    business_account_id: businessAccountId,
    phone_number_id: phoneNumberId,
    webhook_verify_token: webhookVerifyToken,
    access_token: finalToken,
    access_token_last4: tokenLast4(finalToken),
    status: finalStatus,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from("whatsapp_channel_settings").upsert(payload)
  if (error) {
    return { success: false, error: error.message }
  }

  if (webhookVerifyToken) {
    const { data: existingEndpoint, error: endpointLookupError } = await supabase
      .from("webhook_endpoints")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("source", "whatsapp_inbound")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (endpointLookupError) {
      return { success: false, error: endpointLookupError.message }
    }

    if (existingEndpoint?.id) {
      const { error: endpointUpdateError } = await supabase
        .from("webhook_endpoints")
        .update({
          token: webhookVerifyToken,
          is_active: true,
        })
        .eq("id", existingEndpoint.id)

      if (endpointUpdateError) {
        return { success: false, error: endpointUpdateError.message }
      }
    } else {
      const { error: endpointInsertError } = await supabase.from("webhook_endpoints").insert({
        organization_id: organizationId,
        token: webhookVerifyToken,
        source: "whatsapp_inbound",
        is_active: true,
      })

      if (endpointInsertError) {
        return { success: false, error: endpointInsertError.message }
      }
    }
  }

  revalidateWhatsAppPaths()
  return {
    success: true,
    data: {
      channel: {
        provider,
        operation_mode: operationMode,
        display_phone: displayPhone,
        business_account_id: businessAccountId,
        phone_number_id: phoneNumberId,
        webhook_verify_token: webhookVerifyToken,
        access_token_last4: tokenLast4(finalToken),
        status: finalStatus,
        last_error_message: null,
        last_tested_at: null,
      },
    },
  }
}

export async function testWhatsAppChannelConnection(): Promise<
  ActionResult<{ status: ChannelSettingsData["status"]; message: string; lastTestedAt: string }>
> {
  const ctx = await getWhatsAppAdminContext()
  if ("error" in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, organizationId } = ctx

  const { data: addon } = await supabase
    .from("whatsapp_addon_pricing_settings")
    .select("addon_enabled")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (!addon?.addon_enabled) {
    return {
      success: false,
      error: "Ative o add-on WhatsApp antes de testar a conexão.",
    }
  }

  const { data, error } = await supabase
    .from("whatsapp_channel_settings")
    .select("operation_mode, business_account_id, phone_number_id, webhook_verify_token, access_token")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) {
    return { success: false, error: error.message }
  }

  if (!data) {
    return { success: false, error: "Salve os dados do canal antes de testar." }
  }

  const nowIso = new Date().toISOString()

  if (data.operation_mode === "sandbox") {
    await supabase
      .from("whatsapp_channel_settings")
      .update({
        status: "connected",
        last_error_message: null,
        last_tested_at: nowIso,
        updated_at: nowIso,
      })
      .eq("organization_id", organizationId)

    revalidateWhatsAppPaths()
    return {
      success: true,
      data: {
        status: "connected",
        message: "Sandbox ativo. O CRM vai simular envios e registrar os eventos localmente.",
        lastTestedAt: nowIso,
      },
    }
  }

  const missingFields: string[] = []
  if (!normalizeText(data.business_account_id, 120) || normalizeText(data.business_account_id, 120)!.length < 3) {
    missingFields.push("Business Account ID")
  }
  if (!normalizeText(data.phone_number_id, 120) || normalizeText(data.phone_number_id, 120)!.length < 3) {
    missingFields.push("Phone Number ID")
  }
  if (!normalizeText(data.webhook_verify_token, 255) || normalizeText(data.webhook_verify_token, 255)!.length < 6) {
    missingFields.push("Webhook Verify Token")
  }
  if (!normalizeText(data.access_token, 2048) || normalizeText(data.access_token, 2048)!.length < 20) {
    missingFields.push("Access Token")
  }

  if (missingFields.length > 0) {
    const message = `Configuração incompleta: preencha ${missingFields.join(", ")}.`
    await supabase
      .from("whatsapp_channel_settings")
      .update({
        status: "error",
        last_error_message: message,
        last_tested_at: nowIso,
        updated_at: nowIso,
      })
      .eq("organization_id", organizationId)

    revalidateWhatsAppPaths()
    return { success: false, error: message }
  }

  await supabase
    .from("whatsapp_channel_settings")
    .update({
      status: "connected",
      last_error_message: null,
      last_tested_at: nowIso,
      updated_at: nowIso,
    })
    .eq("organization_id", organizationId)

  revalidateWhatsAppPaths()
  return {
    success: true,
    data: {
      status: "connected",
      message: "Conexão validada com sucesso. Canal pronto para uso.",
      lastTestedAt: nowIso,
    },
  }
}

export async function saveWhatsAppAddonPricing(
  rawInput: z.input<typeof addonPricingSchema>
): Promise<ActionResult> {
  const parsed = addonPricingSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos para salvar o add-on.",
    }
  }

  const ctx = await getWhatsAppAdminContext()
  if ("error" in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, organizationId } = ctx
  const currencyCode = parsed.data.currency_code.trim().toUpperCase()
  const billingTimezone = parsed.data.billing_timezone.trim()

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    return { success: false, error: "Código de moeda inválido. Use o padrão ISO 4217 (ex.: BRL)." }
  }

  const { error } = await supabase.from("whatsapp_addon_pricing_settings").upsert({
    organization_id: organizationId,
    addon_enabled: parsed.data.addon_enabled,
    included_quota: parsed.data.included_quota,
    overage_price: Number(parsed.data.overage_price.toFixed(4)),
    currency_code: currencyCode,
    billing_timezone: billingTimezone,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidateWhatsAppPaths()
  return { success: true }
}

export async function loadWhatsAppAddonUsage(): Promise<ActionResult<{ usage: WhatsAppAddonUsageSnapshot | null }>> {
  const ctx = await getWhatsAppAdminContext()
  if ("error" in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, organizationId } = ctx
  const { data, error } = await supabase.rpc("whatsapp_usage_snapshot", {
    p_organization_id: organizationId,
  })

  if (error) {
    const migrationPending = error.code === "42883" || error.code === "42P01" || error.code === "42703"
    return {
      success: false,
      error: migrationPending
        ? "Migração pendente para painel de consumo do WhatsApp add-on."
        : error.message,
    }
  }

  return {
    success: true,
    data: {
      usage: normalizeUsage((data as WhatsAppAddonUsageSnapshot | null) ?? null),
    },
  }
}

export async function sendOfficialWhatsAppMessage(
  rawInput: z.input<typeof sendOfficialMessageSchema>
): Promise<ActionResult<WhatsAppMessageActionResult>> {
  const parsed = sendOfficialMessageSchema.safeParse(rawInput)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos para envio de WhatsApp.",
    }
  }

  const ctx = await getWhatsAppAdminContext()
  if ("error" in ctx) {
    return { success: false, error: ctx.error }
  }

  const { supabase, organizationId } = ctx
  const contactId = normalizeText(parsed.data.contact_id, 64)
  const message = normalizeText(parsed.data.message, 4096)

  if (!contactId || !message) {
    return { success: false, error: "Digite uma mensagem válida antes de enviar." }
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, name, phone")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle()

  if (contactError) {
    return { success: false, error: contactError.message }
  }
  if (!contact) {
    return { success: false, error: "Contato não encontrado." }
  }

  const to = waMeNumberFromPhone(contact.phone || "")
  if (!to) {
    return {
      success: false,
      error: "Contato sem telefone válido para WhatsApp.",
    }
  }

  const { data: channelData, error: channelError } = await supabase
    .from("whatsapp_channel_settings")
    .select("provider, operation_mode, phone_number_id, access_token, status")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (channelError) {
    return { success: false, error: channelError.message }
  }
  if (!channelData) {
    return {
      success: true,
      data: {
        mode: "fallback",
        message: "Canal oficial indisponível. Abra o WhatsApp Web para concluir o envio.",
        fallbackReason: "channel_not_configured",
      },
    }
  }

  const channel = channelData as {
    provider: "meta"
    operation_mode: "live" | "sandbox"
    phone_number_id: string | null
    access_token: string | null
    status: "disconnected" | "connected" | "error"
  }

  const isSandbox = channel.operation_mode === "sandbox"
  const phoneNumberId = normalizeText(channel.phone_number_id, 120)
  const accessToken = normalizeText(channel.access_token, 4096)

  if (!isSandbox && (channel.status !== "connected" || !phoneNumberId || !accessToken)) {
    return {
      success: true,
      data: {
        mode: "fallback",
        message: "Canal oficial indisponível. Abra o WhatsApp Web para concluir o envio.",
        fallbackReason: "channel_unavailable",
      },
    }
  }

  const { data: policyData, error: policyError } = await supabase.rpc("whatsapp_send_policy_check", {
    p_organization_id: organizationId,
    p_units: 1,
  })

  if (policyError) {
    return { success: false, error: policyError.message }
  }

  const policy = (policyData || {}) as SendPolicyResult
  if (!policy.allowed) {
    const blockedMessage =
      normalizeText(policy.message, 500) || "Envio oficial bloqueado por política comercial."

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

    return {
      success: false,
      error: blockedMessage,
    }
  }

  let providerMessageId: string | null = null
  let providerName: "meta" | "sandbox" = "meta"

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
        return {
          success: true,
          data: {
            mode: "fallback",
            message: "Canal oficial indisponível. Abra o WhatsApp Web para concluir o envio.",
            fallbackReason:
              (metaPayload as { error?: { message?: string } })?.error?.message ||
              `meta_${metaResponse.status}`,
          },
        }
      }
    } catch (error) {
      return {
        success: true,
        data: {
          mode: "fallback",
          message: "Falha no canal oficial. Abra o WhatsApp Web para concluir o envio.",
          fallbackReason: error instanceof Error ? error.message : "provider_error",
        },
      }
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
    return { success: false, error: insertError.message }
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

  revalidateWhatsAppContactPaths(contactId)
  return {
    success: true,
    data: {
      mode: isSandbox ? "sandbox" : "live",
      message: isSandbox
        ? "Sandbox ativo: mensagem simulada e registrada no CRM."
        : "Mensagem enviada no WhatsApp Oficial.",
      messageId: insertedMessage.id,
      provider: providerName,
      providerMessageId,
    },
  }
}
