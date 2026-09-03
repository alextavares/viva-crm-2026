"use server"

import { resolveCname } from "node:dns/promises"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  isPortalIntegrationActive,
  rotatePortalCredentials,
  stripSecretConfigKeys,
  toCanonicalPortalStatus,
} from "@/lib/integrations/portal-credentials"
import { isAdmin, messageTemplateSchema, type ActionResult, type MessageTemplate } from "@/lib/types"

const leadDistributionSchema = z.object({
    enabled: z.boolean(),
    slaMinutes: z.coerce.number().min(1).max(1440),
    redistributeOverdue: z.boolean(),
})

const followupSettingsSchema = z.object({
    enabled: z.boolean(),
    step5m: z.string().trim().optional().or(z.literal("")),
    step24h: z.string().trim().optional().or(z.literal("")),
    step3d: z.string().trim().optional().or(z.literal("")),
})

const messageTemplateSaveSchema = messageTemplateSchema.extend({
    id: z.string().optional(),
    variables: z.array(z.string()).optional(),
})

const siteThemeSchema = z.enum(["search_first", "search_highlights", "premium", "trust_first", "compact_mobile"])
const sitePlacementSchema = z.enum(["topbar", "popup", "hero", "footer"])
const siteBannerVariantSchema = z.enum(["compact", "destaque"])
const sitePageKeySchema = z.enum(["about", "contact", "lgpd"])
const portalIntegrationSchema = z.enum(["zap_vivareal", "imovelweb"])

const siteSettingsSchema = z.object({
    theme: siteThemeSchema,
    brandName: z.string().trim().min(1, "Informe o nome da marca."),
    logoUrl: z.string().trim().nullable().optional(),
    logoPath: z.string().trim().nullable().optional(),
    primaryColor: z.string().trim().nullable().optional(),
    secondaryColor: z.string().trim().nullable().optional(),
    whatsapp: z.string().trim().min(1, "Informe o WhatsApp."),
    phone: z.string().trim().nullable().optional(),
    email: z.string().trim().min(1, "Informe o e-mail."),
})

const siteTrackingSchema = z.object({
    ga4MeasurementId: z.string().trim().nullable().optional(),
    metaPixelId: z.string().trim().nullable().optional(),
    googleSiteVerification: z.string().trim().nullable().optional(),
    facebookDomainVerification: z.string().trim().nullable().optional(),
    googleAdsConversionId: z.string().trim().nullable().optional(),
    googleAdsConversionLabel: z.string().trim().nullable().optional(),
})

const siteDomainSchema = z.object({
    domain: z.string().trim().min(1, "Informe o domínio."),
})

const onboardingCollapseSchema = z.object({
    collapsed: z.boolean(),
})

const sitePageSaveSchema = z.object({
    key: sitePageKeySchema,
    title: z.string().trim().nullable().optional(),
    content: z.string().trim().nullable().optional(),
    is_published: z.boolean(),
})

const sitePagesSchema = z.object({
    pages: z.array(sitePageSaveSchema).min(1, "Nenhuma página para salvar."),
})

const siteBannerSchema = z.object({
    placement: sitePlacementSchema,
    variant: siteBannerVariantSchema,
    title: z.string().trim().nullable().optional(),
    body: z.string().trim().nullable().optional(),
    image_url: z.string().trim().nullable().optional(),
    image_path: z.string().trim().nullable().optional(),
    link_url: z.string().trim().nullable().optional(),
    starts_at: z.string().trim().nullable().optional(),
    ends_at: z.string().trim().nullable().optional(),
    is_active: z.boolean(),
    priority: z.coerce.number(),
})

const siteBannerUpdateSchema = z.object({
    id: z.string().uuid("Banner inválido."),
    banner: siteBannerSchema,
})

const siteBannerDeleteSchema = z.object({
    id: z.string().uuid("Banner inválido."),
})

const portalToggleSchema = z.object({
    portal: portalIntegrationSchema,
})

async function getAuthContext() {
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
        return { supabase, error: "Sem permissão." }
    }

    const { data: organization } = await supabase
        .from("organizations")
        .select("id, slug")
        .eq("id", profile.organization_id)
        .single()

    return { supabase, user, profile, organization }
}

function revalidateSitePaths(slug?: string | null) {
    revalidatePath("/settings/site")
    revalidatePath("/settings")
    revalidatePath("/dashboard")
    if (slug) {
        revalidatePath(`/s/${slug}`)
    }
}

function revalidatePortalPaths(portal?: string | null) {
    revalidatePath("/settings/portals")
    revalidatePath("/integrations")
    if (portal) {
        revalidatePath(`/integrations/${portal}`)
    }
}

function normalizeHost(v: string) {
    const host = v.trim().toLowerCase()
    const noScheme = host.replace(/^https?:\/\//, "")
    const noPath = noScheme.split("/")[0]
    const noPort = noPath.split(":")[0]
    return noPort.replace(/\.$/, "")
}

function normalizeCnameTarget(v: string) {
    return v.trim().toLowerCase().replace(/\.$/, "")
}

function humanizeDomainLookupError(error: unknown) {
    const message = error instanceof Error ? error.message : "Falha ao consultar DNS."
    const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
            ? (error as { code: string }).code
            : ""
    const causeCode =
        typeof error === "object" &&
        error !== null &&
        "cause" in error &&
        typeof (error as { cause?: { code?: unknown } }).cause?.code === "string"
            ? ((error as { cause: { code: string } }).cause.code ?? "")
            : ""
    const haystack = `${code} ${causeCode} ${message}`.trim()

    if (/ENOTFOUND/i.test(haystack)) {
        return "Não encontramos o CNAME do domínio. Verifique se o registro DNS foi criado e aguarde a propagação."
    }

    if (/ENODATA|NODATA/i.test(haystack)) {
        return "O domínio ainda não retornou um CNAME válido. Confira o DNS e tente novamente em alguns minutos."
    }

    if (/ETIMEOUT|TIMEOUT/i.test(haystack)) {
        return "O DNS demorou para responder. Aguarde a propagação e tente novamente em alguns minutos."
    }

    if (/ECONNREFUSED/i.test(haystack)) {
        return "A consulta DNS falhou temporariamente. Tente novamente em alguns minutos."
    }

    if (/queryCname|dns/i.test(haystack)) {
        return "Não foi possível validar o DNS agora. Confira o CNAME configurado e tente novamente em alguns minutos."
    }

    return message || "Falha ao consultar DNS."
}

export async function saveLeadDistributionSettings(input: {
    enabled: boolean
    slaMinutes: number
    redistributeOverdue: boolean
}): Promise<ActionResult> {
    try {
        const parsed = leadDistributionSchema.safeParse(input)
        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0]?.message
            return {
                success: false,
                error: firstIssue
                    ? `Dados inválidos na distribuição: ${firstIssue}`
                    : "Dados inválidos na distribuição.",
            }
        }

        const auth = await getAuthContext()
        if ("error" in auth) {
            return { success: false, error: auth.error ?? "Sem permissão." }
        }

        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem alterar a distribuição." }
        }

        const { error } = await auth.supabase.from("lead_distribution_settings").upsert({
            organization_id: auth.profile.organization_id,
            enabled: parsed.data.enabled,
            mode: "round_robin",
            sla_minutes: parsed.data.slaMinutes,
            redistribute_overdue: parsed.data.redistributeOverdue,
            updated_at: new Date().toISOString(),
        })

        if (error) {
            return { success: false, error: error.message || "Erro ao salvar distribuição de leads." }
        }

        revalidatePath("/settings/leads")
        return { success: true }
    } catch (error) {
        console.error("Error saving lead distribution settings:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao salvar distribuição de leads.",
        }
    }
}

export async function saveFollowupSettings(input: {
    enabled: boolean
    step5m: string
    step24h: string
    step3d: string
}): Promise<ActionResult> {
    try {
        const parsed = followupSettingsSchema.safeParse(input)
        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0]?.message
            return {
                success: false,
                error: firstIssue
                    ? `Dados inválidos no follow-up: ${firstIssue}`
                    : "Dados inválidos no follow-up.",
            }
        }

        const auth = await getAuthContext()
        if ("error" in auth) {
            return { success: false, error: auth.error ?? "Sem permissão." }
        }

        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem alterar o follow-up." }
        }

        const { error } = await auth.supabase.from("followup_settings").upsert({
            organization_id: auth.profile.organization_id,
            enabled: parsed.data.enabled,
            step_5m_template: (parsed.data.step5m ?? "").trim(),
            step_24h_template: (parsed.data.step24h ?? "").trim(),
            step_3d_template: (parsed.data.step3d ?? "").trim(),
            updated_at: new Date().toISOString(),
        })

        if (error) {
            return { success: false, error: error.message || "Erro ao salvar follow-up." }
        }

        revalidatePath("/settings/followup")
        return { success: true }
    } catch (error) {
        console.error("Error saving followup settings:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao salvar follow-up.",
        }
    }
}

export async function saveMessageTemplate(input: {
    id?: string
    title: string
    content: string
    channel: "whatsapp" | "email"
    variables?: string[]
}): Promise<ActionResult<{ template: MessageTemplate }>> {
    try {
        const parsed = messageTemplateSaveSchema.safeParse(input)
        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0]?.message
            return {
                success: false,
                error: firstIssue ? `Dados inválidos no template: ${firstIssue}` : "Dados inválidos no template.",
            }
        }

        const auth = await getAuthContext()
        if ("error" in auth) {
            return { success: false, error: auth.error ?? "Sem permissão." }
        }

        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem alterar templates." }
        }

        if (parsed.data.id) {
            const { data: updated, error } = await auth.supabase
                .from("message_templates")
                .update({
                    title: parsed.data.title,
                    content: parsed.data.content,
                    channel: parsed.data.channel,
                    variables: parsed.data.variables ?? [],
                    updated_at: new Date().toISOString(),
                })
                .eq("id", parsed.data.id)
                .eq("organization_id", auth.profile.organization_id)
                .select("*")
                .single()

            if (error) {
                return { success: false, error: error.message || "Erro ao atualizar template." }
            }

            if (!updated) {
                return { success: false, error: "Template não encontrado para atualização." }
            }

            revalidatePath("/settings/templates")
            return { success: true, data: { template: updated as MessageTemplate } }
        }

        const { data: created, error } = await auth.supabase
            .from("message_templates")
            .insert({
                organization_id: auth.profile.organization_id,
                title: parsed.data.title,
                content: parsed.data.content,
                channel: parsed.data.channel,
                variables: parsed.data.variables ?? [],
                created_by: auth.user.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select("*")
            .single()

        if (error) {
            return { success: false, error: error.message || "Erro ao criar template." }
        }

        if (!created) {
            return { success: false, error: "Template não foi criado." }
        }

        revalidatePath("/settings/templates")
        return { success: true, data: { template: created as MessageTemplate } }
    } catch (error) {
        console.error("Error saving message template:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao salvar template.",
        }
    }
}

export async function deleteMessageTemplate(id: string): Promise<ActionResult> {
    try {
        const auth = await getAuthContext()
        if ("error" in auth) {
            return { success: false, error: auth.error ?? "Sem permissão." }
        }

        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem excluir templates." }
        }

        const { error } = await auth.supabase
            .from("message_templates")
            .delete()
            .eq("id", id)
            .eq("organization_id", auth.profile.organization_id)

        if (error) {
            return { success: false, error: error.message || "Erro ao excluir template." }
        }

        revalidatePath("/settings/templates")
        return { success: true }
    } catch (error) {
        console.error("Error deleting message template:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao excluir template.",
        }
    }
}

export async function saveSiteSettings(input: {
    theme: "search_first" | "search_highlights" | "premium" | "trust_first" | "compact_mobile"
    brandName: string
    logoUrl?: string | null
    logoPath?: string | null
    primaryColor?: string | null
    secondaryColor?: string | null
    whatsapp: string
    phone?: string | null
    email: string
}): Promise<ActionResult> {
    try {
        const parsed = siteSettingsSchema.safeParse(input)
        if (!parsed.success) {
            return {
                success: false,
                error: parsed.error.issues[0]?.message || "Dados inválidos nas configurações do site.",
            }
        }

        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem alterar o site." }
        }

        const { error } = await auth.supabase.from("site_settings").upsert({
            organization_id: auth.profile.organization_id,
            theme: parsed.data.theme,
            brand_name: parsed.data.brandName || null,
            logo_url: parsed.data.logoUrl || null,
            logo_path: parsed.data.logoPath || null,
            primary_color: parsed.data.primaryColor || null,
            secondary_color: parsed.data.secondaryColor || null,
            whatsapp: parsed.data.whatsapp || null,
            phone: parsed.data.phone || null,
            email: parsed.data.email || null,
            updated_at: new Date().toISOString(),
        })

        if (error) {
            return { success: false, error: error.message || "Erro ao salvar configurações do site." }
        }

        revalidateSitePaths(auth.organization?.slug ?? null)
        return { success: true }
    } catch (error) {
        console.error("Error saving site settings:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao salvar configurações do site.",
        }
    }
}

export async function saveSiteTrackingSettings(input: {
    ga4MeasurementId?: string | null
    metaPixelId?: string | null
    googleSiteVerification?: string | null
    facebookDomainVerification?: string | null
    googleAdsConversionId?: string | null
    googleAdsConversionLabel?: string | null
}): Promise<ActionResult> {
    try {
        const parsed = siteTrackingSchema.safeParse(input)
        if (!parsed.success) {
            return {
                success: false,
                error: parsed.error.issues[0]?.message || "Dados inválidos no rastreamento do site.",
            }
        }

        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem alterar o rastreamento." }
        }

        const { error } = await auth.supabase.from("site_settings").upsert({
            organization_id: auth.profile.organization_id,
            ga4_measurement_id: parsed.data.ga4MeasurementId || null,
            meta_pixel_id: parsed.data.metaPixelId || null,
            google_site_verification: parsed.data.googleSiteVerification || null,
            facebook_domain_verification: parsed.data.facebookDomainVerification || null,
            google_ads_conversion_id: parsed.data.googleAdsConversionId || null,
            google_ads_conversion_label: parsed.data.googleAdsConversionLabel || null,
            updated_at: new Date().toISOString(),
        })

        if (error) {
            return { success: false, error: error.message || "Erro ao salvar rastreamento do site." }
        }

        revalidateSitePaths(auth.organization?.slug ?? null)
        return { success: true }
    } catch (error) {
        console.error("Error saving site tracking settings:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao salvar rastreamento do site.",
        }
    }
}

export async function saveSiteDomain(input: { domain: string }): Promise<ActionResult<{ domain: Record<string, unknown> }>> {
    try {
        const parsed = siteDomainSchema.safeParse(input)
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Domínio inválido." }
        }

        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem alterar o domínio." }
        }

        const { data, error } = await auth.supabase
            .from("custom_domains")
            .upsert({
                organization_id: auth.profile.organization_id,
                domain: parsed.data.domain,
                status: "pending",
                last_error: null,
                updated_at: new Date().toISOString(),
            })
            .select("*")
            .single()

        if (error) {
            return { success: false, error: error.message || "Erro ao salvar domínio." }
        }

        revalidateSitePaths(auth.organization?.slug ?? null)
        return { success: true, data: { domain: (data ?? {}) as Record<string, unknown> } }
    } catch (error) {
        console.error("Error saving site domain:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao salvar domínio.",
        }
    }
}

export async function verifyCustomDomain(): Promise<
    ActionResult<{ domain: Record<string, unknown>; message: string; expected: string }>
> {
    try {
        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem verificar o domínio." }
        }

        const { data: row, error: rowError } = await auth.supabase
            .from("custom_domains")
            .select("*")
            .eq("organization_id", auth.profile.organization_id)
            .maybeSingle()

        if (rowError) {
            return { success: false, error: rowError.message || "Erro ao carregar domínio." }
        }

        if (!row?.domain) {
            return { success: false, error: "Nenhum domínio configurado." }
        }

        const domain = normalizeHost(String(row.domain))
        if (!domain.startsWith("www.")) {
            return {
                success: false,
                error: "No MVP, use um domínio começando com www. (ex.: www.seudominio.com.br).",
            }
        }

        const expected = normalizeCnameTarget(process.env.SITES_CNAME_TARGET || "sites.vivacrm.com.br")
        const now = new Date().toISOString()

        let resolved: string[] = []
        try {
            resolved = (await resolveCname(domain)).map(normalizeCnameTarget)
        } catch (error) {
            const message = humanizeDomainLookupError(error)
            await auth.supabase
                .from("custom_domains")
                .update({
                    status: "error",
                    last_error: message,
                    last_checked_at: now,
                    updated_at: now,
                })
                .eq("organization_id", auth.profile.organization_id)
                .select("*")
                .single()

            revalidateSitePaths(auth.organization?.slug ?? null)
            return {
                success: false,
                error: message,
            }
        }

        const matches = resolved.some((target) => target === expected)
        if (!matches) {
            const message = `CNAME não encontrado. Esperado: ${expected}. Encontrado: ${resolved.join(", ") || "(vazio)"}`
            await auth.supabase
                .from("custom_domains")
                .update({
                    status: "error",
                    last_error: message,
                    last_checked_at: now,
                    updated_at: now,
                })
                .eq("organization_id", auth.profile.organization_id)

            revalidateSitePaths(auth.organization?.slug ?? null)
            return {
                success: false,
                error: message,
            }
        }

        const { data: updated, error: updateError } = await auth.supabase
            .from("custom_domains")
            .update({
                status: "verified",
                last_error: null,
                last_checked_at: now,
                updated_at: now,
            })
            .eq("organization_id", auth.profile.organization_id)
            .select("*")
            .single()

        if (updateError) {
            return { success: false, error: updateError.message || "Erro ao atualizar status do domínio." }
        }

        revalidateSitePaths(auth.organization?.slug ?? null)
        return {
            success: true,
            data: {
                domain: (updated ?? row ?? {}) as Record<string, unknown>,
                message: "Domínio verificado com sucesso.",
                expected,
            },
        }
    } catch (error) {
        console.error("Error verifying custom domain:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao verificar domínio.",
        }
    }
}

export async function setOnboardingCollapsed(input: { collapsed: boolean }): Promise<ActionResult<{ collapsed: boolean }>> {
    try {
        const parsed = onboardingCollapseSchema.safeParse(input)
        if (!parsed.success) {
            return {
                success: false,
                error: parsed.error.issues[0]?.message || "Valor inválido para o onboarding.",
            }
        }

        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem alterar o onboarding." }
        }

        const { error } = await auth.supabase.from("site_settings").upsert({
            organization_id: auth.profile.organization_id,
            onboarding_collapsed: parsed.data.collapsed,
            updated_at: new Date().toISOString(),
        })

        if (error) {
            return { success: false, error: error.message || "Erro ao atualizar o onboarding." }
        }

        revalidatePath("/dashboard")
        return { success: true, data: { collapsed: parsed.data.collapsed } }
    } catch (error) {
        console.error("Error saving onboarding collapsed state:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao atualizar o onboarding.",
        }
    }
}

export async function setWhatsAppOnboardingCollapsed(
    input: { collapsed: boolean }
): Promise<ActionResult<{ collapsed: boolean }>> {
    try {
        const parsed = onboardingCollapseSchema.safeParse(input)
        if (!parsed.success) {
            return {
                success: false,
                error: parsed.error.issues[0]?.message || "Valor inválido para o onboarding do WhatsApp.",
            }
        }

        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem alterar o onboarding do WhatsApp." }
        }

        const { error } = await auth.supabase.from("site_settings").upsert({
            organization_id: auth.profile.organization_id,
            whatsapp_onboarding_collapsed: parsed.data.collapsed,
            updated_at: new Date().toISOString(),
        })

        if (error) {
            return { success: false, error: error.message || "Erro ao atualizar o onboarding do WhatsApp." }
        }

        revalidatePath("/dashboard")
        return { success: true, data: { collapsed: parsed.data.collapsed } }
    } catch (error) {
        console.error("Error saving WhatsApp onboarding collapsed state:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao atualizar o onboarding do WhatsApp.",
        }
    }
}

export async function saveSitePages(input: {
    pages: Array<{
        key: "about" | "contact" | "lgpd"
        title?: string | null
        content?: string | null
        is_published: boolean
    }>
}): Promise<ActionResult> {
    try {
        const parsed = sitePagesSchema.safeParse(input)
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Dados inválidos nas páginas." }
        }

        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem alterar as páginas do site." }
        }

        const rows = parsed.data.pages.map((page) => ({
            organization_id: auth.profile.organization_id,
            key: page.key,
            title: page.title?.trim() || null,
            content: page.content?.trim() || null,
            is_published: page.is_published,
            updated_at: new Date().toISOString(),
        }))

        const { error } = await auth.supabase.from("site_pages").upsert(rows, { onConflict: "organization_id,key" })

        if (error) {
            return { success: false, error: error.message || "Erro ao salvar páginas do site." }
        }

        revalidateSitePaths(auth.organization?.slug ?? null)
        return { success: true }
    } catch (error) {
        console.error("Error saving site pages:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao salvar páginas do site.",
        }
    }
}

export async function createSiteBanner(input: z.infer<typeof siteBannerSchema>): Promise<ActionResult<{ banner: Record<string, unknown> }>> {
    try {
        const parsed = siteBannerSchema.safeParse(input)
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Dados inválidos no banner." }
        }

        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem criar banners." }
        }

        const { data, error } = await auth.supabase
            .from("site_banners")
            .insert({
                organization_id: auth.profile.organization_id,
                placement: parsed.data.placement,
                variant: parsed.data.variant,
                title: parsed.data.title?.trim() || null,
                body: parsed.data.body?.trim() || null,
                image_url: parsed.data.image_url?.trim() || null,
                image_path: parsed.data.image_path?.trim() || null,
                link_url: parsed.data.link_url?.trim() || null,
                starts_at: parsed.data.starts_at?.trim() || null,
                ends_at: parsed.data.ends_at?.trim() || null,
                is_active: parsed.data.is_active,
                priority: Number.isFinite(parsed.data.priority) ? parsed.data.priority : 0,
                updated_at: new Date().toISOString(),
            })
            .select("*")
            .single()

        if (error) {
            return { success: false, error: error.message || "Erro ao criar banner." }
        }

        revalidateSitePaths(auth.organization?.slug ?? null)
        return { success: true, data: { banner: (data ?? {}) as Record<string, unknown> } }
    } catch (error) {
        console.error("Error creating site banner:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao criar banner.",
        }
    }
}

export async function updateSiteBanner(input: {
    id: string
    banner: z.infer<typeof siteBannerSchema>
}): Promise<ActionResult<{ banner: Record<string, unknown> }>> {
    try {
        const parsed = siteBannerUpdateSchema.safeParse(input)
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Dados inválidos no banner." }
        }

        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem editar banners." }
        }

        const { data, error } = await auth.supabase
            .from("site_banners")
            .update({
                placement: parsed.data.banner.placement,
                variant: parsed.data.banner.variant,
                title: parsed.data.banner.title?.trim() || null,
                body: parsed.data.banner.body?.trim() || null,
                image_url: parsed.data.banner.image_url?.trim() || null,
                image_path: parsed.data.banner.image_path?.trim() || null,
                link_url: parsed.data.banner.link_url?.trim() || null,
                starts_at: parsed.data.banner.starts_at?.trim() || null,
                ends_at: parsed.data.banner.ends_at?.trim() || null,
                is_active: parsed.data.banner.is_active,
                priority: Number.isFinite(parsed.data.banner.priority) ? parsed.data.banner.priority : 0,
                updated_at: new Date().toISOString(),
            })
            .eq("id", parsed.data.id)
            .eq("organization_id", auth.profile.organization_id)
            .select("*")
            .single()

        if (error) {
            return { success: false, error: error.message || "Erro ao atualizar banner." }
        }

        revalidateSitePaths(auth.organization?.slug ?? null)
        return { success: true, data: { banner: (data ?? {}) as Record<string, unknown> } }
    } catch (error) {
        console.error("Error updating site banner:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao atualizar banner.",
        }
    }
}

export async function deleteSiteBanner(input: { id: string }): Promise<ActionResult<{ deletedId: string }>> {
    try {
        const parsed = siteBannerDeleteSchema.safeParse(input)
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Banner inválido." }
        }

        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem excluir banners." }
        }

        const { error } = await auth.supabase
            .from("site_banners")
            .delete()
            .eq("id", parsed.data.id)
            .eq("organization_id", auth.profile.organization_id)

        if (error) {
            return { success: false, error: error.message || "Erro ao excluir banner." }
        }

        revalidateSitePaths(auth.organization?.slug ?? null)
        return { success: true, data: { deletedId: parsed.data.id } }
    } catch (error) {
        console.error("Error deleting site banner:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao excluir banner.",
        }
    }
}

export async function togglePortalIntegration(input: {
    portal: "zap_vivareal" | "imovelweb"
}): Promise<ActionResult<{ integration: Record<string, unknown>; feedSecretOnce: string | null; webhookSecretOnce: string | null }>> {
    try {
        const parsed = portalToggleSchema.safeParse(input)
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message || "Portal inválido." }
        }

        const auth = await getAuthContext()
        if ("error" in auth) return { success: false, error: auth.error ?? "Sem permissão." }
        if (!isAdmin(auth.profile?.role)) {
            return { success: false, error: "Apenas gestores podem alterar integrações de portais." }
        }

        const { data: existing } = await auth.supabase
            .from("portal_integrations")
            .select("*")
            .eq("organization_id", auth.profile.organization_id)
            .eq("portal", parsed.data.portal)
            .maybeSingle()

        const isCurrentlyActive = isPortalIntegrationActive(existing?.status)
        const nextStatus = toCanonicalPortalStatus(!isCurrentlyActive)
        // Canonical credential boundary: enabling rotates distinct
        // feed/webhook secrets (returned once, never stored). Carried-over
        // config is stripped of any legacy secret keys.
        let feedSecretOnce: string | null = null
        let webhookSecretOnce: string | null = null
        const config = stripSecretConfigKeys(
          ((existing?.config as Record<string, unknown> | null) ?? {}) as Record<string, unknown>
        )
        if (nextStatus === "enabled" && existing?.status !== "enabled") {
            const rotated = await rotatePortalCredentials(auth.supabase, parsed.data.portal)
            if (!rotated.ok) {
                return { success: false, error: rotated.error }
            }
            feedSecretOnce = rotated.rotation.feedSecretOnce
            webhookSecretOnce = rotated.rotation.webhookSecretOnce
            config.feed_credential_last4 = rotated.rotation.feedLast4
            config.webhook_credential_last4 = rotated.rotation.webhookLast4
        }

        const { data, error } = await auth.supabase
            .from("portal_integrations")
            .upsert({
                organization_id: auth.profile.organization_id,
                portal: parsed.data.portal,
                status: nextStatus,
                config,
                updated_at: new Date().toISOString(),
            }, { onConflict: "organization_id,portal" })
            .select("*")
            .single()

        if (error) {
            return { success: false, error: error.message || "Erro ao alternar integração do portal." }
        }

        revalidatePortalPaths(parsed.data.portal)
        return { success: true, data: { integration: (data ?? {}) as Record<string, unknown>, feedSecretOnce, webhookSecretOnce } }
    } catch (error) {
        console.error("Error toggling portal integration:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao alternar integração do portal.",
        }
    }
}
