"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
  PORTALS,
  type IntegrationIssueSeverity,
  type PortalIntegrationIssueRow,
  type PortalKey,
} from "@/lib/integrations"
import { getImovelwebReadinessIssues } from "@/lib/integrations/imovelweb-readiness"
import { isAdmin, type ActionResult } from "@/lib/types"

const portalKeySchema = z.enum(PORTALS)

const portalLeadAssignmentSchema = z.enum(["by_property", "round_robin", "owner_manager"])
const portalLeadAssignmentFallbackSchema = z.enum(["owner_manager", "round_robin"])
const portalMapVisibilitySchema = z.enum(["NO", "EXACTO", "APROXIMADO", "EXATO"])
const localidadeMappingLinePattern = /^[A-Z]{2}\|[^=|]+(?:\|[^=|]+)?=[^=\s].*$/

function validateLocalidadeMappingsRaw(value: string) {
  if (!value) {
    return true
  }

  const lines = value
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), index: index + 1 }))
    .filter(({ line }) => line.length > 0)

  const invalidLine = lines.find(({ line }) => !localidadeMappingLinePattern.test(line))
  if (!invalidLine) {
    return true
  }

  return {
    line: invalidLine.index,
    value: invalidLine.line,
  }
}

const savePortalIntegrationConfigSchema = z.object({
  portal: portalKeySchema,
  enabled: z.boolean(),
  exportEnabled: z.boolean(),
  sendOnlyAvailable: z.boolean(),
  sendOnlyWithPhotos: z.boolean(),
  existingFeedToken: z.string().trim().optional().default(""),
  leadAssignment: portalLeadAssignmentSchema.default("by_property"),
  leadAssignmentFallback: portalLeadAssignmentFallbackSchema.default("owner_manager"),
  slaMinutes: z.coerce.number().int().min(5).max(1440),
  codigoImobiliaria: z.string().trim().optional().default(""),
  tipoPublicacaoDefault: z.string().trim().min(1).default("SIMPLE"),
  defaultLocalidadeId: z.string().trim().optional().default(""),
  nomeContato: z.string().trim().optional().default(""),
  emailContato: z.string().trim().optional().default(""),
  telefoneContato: z.string().trim().optional().default(""),
  mostrarMapa: portalMapVisibilitySchema.default("NO"),
  localidadeMappingsRaw: z.string().trim().optional().default(""),
}).superRefine((value, ctx) => {
  const validation = validateLocalidadeMappingsRaw(value.localidadeMappingsRaw)
  if (validation === true) {
    return
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["localidadeMappingsRaw"],
    message: `Linha ${validation.line} inválida em localidades. Use UF|Cidade=ID ou UF|Cidade|Bairro=ID.`,
  })
})

const analyzePortalIntegrationIssuesSchema = z.object({
  portal: portalKeySchema,
})

type PropertyRowForIssues = {
  id: string
  title: string | null
  description: string | null
  price: number | null
  type: string | null
  status: string | null
  images: string[] | null
  image_paths: string[] | null
  address: {
    city?: string | null
    state?: string | null
    zip?: string | null
    street?: string | null
    full_address?: string | null
    neighborhood?: string | null
    lat?: number | null
    lng?: number | null
    [key: string]: unknown
  } | null
  features: Record<string, unknown> | null
  hide_from_site: boolean | null
}

type IntegrationAuthContext =
  | { supabase: Awaited<ReturnType<typeof createClient>>; error: string }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>
      profile: { organization_id: string; role: string | null }
    }

function buildGenericPortalIssues(
  properties: PropertyRowForIssues[],
  organizationId: string,
  portalKey: PortalKey,
  options: {
    sendOnlyAvailable: boolean
    sendOnlyWithPhotos: boolean
  }
): Omit<PortalIntegrationIssueRow, "id" | "created_at" | "resolved_at" | "is_resolved">[] {
  const nextIssues: Omit<PortalIntegrationIssueRow, "id" | "created_at" | "resolved_at" | "is_resolved">[] = []
  const hiddenCount = properties.filter((property) => property.hide_from_site === true).length
  const visibleRows = properties.filter((property) => property.hide_from_site !== true)

  if (visibleRows.length === 0 && hiddenCount > 0) {
    nextIssues.push({
      organization_id: organizationId,
      portal: portalKey,
      property_id: null,
      severity: "warning",
      issue_key: "all_hidden",
      message_human:
        "Nenhum imóvel entra no feed porque todos estão como “Oculto do site”. Publique em massa para liberar a exportação.",
      message_technical: null,
    })
  }

  for (const property of visibleRows) {
    const title = String(property.title ?? "")
    const description = property.description == null ? "" : String(property.description)
    const price = Number(property.price ?? 0)
    const type = String(property.type ?? "")
    const status = String(property.status ?? "")
    const images = Array.isArray(property.images) ? property.images : []
    const imagePaths = Array.isArray(property.image_paths) ? property.image_paths : []
    const photosCount = Math.max(images.length, imagePaths.length)
    const city = property.address?.city ?? ""
    const state = property.address?.state ?? ""
    const zip = property.address?.zip ?? ""
    const propertyLabel = title || "Sem título"

    const add = (severity: IntegrationIssueSeverity, key: string, message: string) => {
      nextIssues.push({
        organization_id: organizationId,
        portal: portalKey,
        property_id: String(property.id),
        severity,
        issue_key: key,
        message_human: message,
        message_technical: null,
      })
    }

    if (options.sendOnlyAvailable && status !== "available") {
      add("warning", "excluded_status", `O imóvel '${propertyLabel}' não entra no feed porque está com status '${status}'.`)
    }

    if (options.sendOnlyWithPhotos && photosCount === 0) {
      add("blocker", "missing_photos", `O imóvel '${propertyLabel}' não pode ser publicado porque não tem fotos.`)
    }

    if (!Number.isFinite(price) || price <= 0) {
      add("blocker", "missing_price", `O imóvel '${propertyLabel}' não pode ser publicado porque falta o preço.`)
    }

    if (!type || type.trim().length === 0) {
      add("blocker", "missing_type", `O imóvel '${propertyLabel}' não pode ser publicado porque falta o tipo do imóvel.`)
    }

    if (!city || !state) {
      add("blocker", "missing_city_state", `O imóvel '${propertyLabel}' não pode ser publicado porque falta Cidade e/ou UF no endereço.`)
    }

    if (!title || title.trim().length < 5) {
      add("blocker", "short_title", `O imóvel '${propertyLabel}' não pode ser publicado porque o título é muito curto.`)
    }

    if (!description || description.trim().length === 0) {
      add("warning", "missing_description", `O imóvel '${propertyLabel}' está sem descrição. Isso pode reduzir a performance no portal.`)
    }

    if (photosCount > 0 && photosCount < 3) {
      add("warning", "few_photos", `O imóvel '${propertyLabel}' tem poucas fotos. Recomendado adicionar pelo menos 3.`)
    }

    if (!zip) {
      add("warning", "missing_zip", `O imóvel '${propertyLabel}' está sem CEP. Isso pode reduzir a qualidade do anúncio.`)
    }
  }

  return nextIssues
}

function revalidateIntegrationPaths(portal: PortalKey) {
  revalidatePath("/integrations")
  revalidatePath(`/integrations/${portal}`)
  revalidatePath(`/integrations/${portal}/report`)
}

async function getIntegrationAuthContext(): Promise<IntegrationAuthContext> {
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
    return { supabase, error: "Sem organização vinculada." }
  }

  if (!isAdmin(profile.role)) {
    return { supabase, error: "Apenas gestores podem alterar integrações." }
  }

  return { supabase, profile }
}

export async function savePortalIntegrationConfig(
  input: z.infer<typeof savePortalIntegrationConfigSchema>
): Promise<ActionResult<{ portal: PortalKey; status: "active" | "inactive" }>> {
  try {
    const parsed = savePortalIntegrationConfigSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Dados inválidos da integração.",
      }
    }

    const auth = await getIntegrationAuthContext()
    if ("error" in auth) {
      return { success: false, error: auth.error }
    }

    const normalizedMostrarMapaRaw = parsed.data.mostrarMapa.toUpperCase()
    const normalizedMostrarMapa = normalizedMostrarMapaRaw === "EXATO" ? "EXACTO" : normalizedMostrarMapaRaw
    const feedToken =
      parsed.data.enabled && parsed.data.exportEnabled
        ? parsed.data.existingFeedToken || crypto.randomUUID()
        : parsed.data.existingFeedToken || ""

    const nextConfig = {
      export_enabled: parsed.data.exportEnabled,
      send_only_available: parsed.data.sendOnlyAvailable,
      send_only_with_photos: parsed.data.sendOnlyWithPhotos,
      feed_token: feedToken,
      lead_assignment: parsed.data.leadAssignment,
      lead_assignment_fallback: parsed.data.leadAssignmentFallback,
      sla_minutes: parsed.data.slaMinutes,
      codigo_imobiliaria: parsed.data.codigoImobiliaria,
      tipo_publicacao_default: parsed.data.tipoPublicacaoDefault.toUpperCase(),
      default_localidade_id: parsed.data.defaultLocalidadeId,
      nome_contato: parsed.data.nomeContato,
      email_contato: parsed.data.emailContato,
      telefone_contato: parsed.data.telefoneContato,
      mostrar_mapa:
        normalizedMostrarMapa === "EXACTO" || normalizedMostrarMapa === "APROXIMADO" || normalizedMostrarMapa === "NO"
          ? normalizedMostrarMapa
          : "NO",
      localidade_mappings_raw: parsed.data.localidadeMappingsRaw,
    }

    const { error } = await auth.supabase.from("portal_integrations").upsert(
      {
        organization_id: auth.profile.organization_id,
        portal: parsed.data.portal,
        status: parsed.data.enabled ? "active" : "inactive",
        config: nextConfig,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,portal" }
    )

    if (error) {
      return {
        success: false,
        error: error.message || "Não foi possível salvar a configuração do portal.",
      }
    }

    revalidateIntegrationPaths(parsed.data.portal)
    return {
      success: true,
      data: {
        portal: parsed.data.portal,
        status: parsed.data.enabled ? "active" : "inactive",
      },
    }
  } catch (error) {
    console.error("Error saving portal integration config:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível salvar a configuração do portal.",
    }
  }
}

export async function analyzePortalIntegrationIssues(
  input: z.infer<typeof analyzePortalIntegrationIssuesSchema>
): Promise<ActionResult<{ totalIssues: number; blockerCount: number; warningCount: number }>> {
  try {
    const parsed = analyzePortalIntegrationIssuesSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Portal inválido.",
      }
    }

    const auth = await getIntegrationAuthContext()
    if ("error" in auth) {
      return { success: false, error: auth.error }
    }

    const { data: integration } = await auth.supabase
      .from("portal_integrations")
      .select("config")
      .eq("organization_id", auth.profile.organization_id)
      .eq("portal", parsed.data.portal)
      .maybeSingle()

    const config = (integration?.config ?? {}) as Record<string, unknown>
    const sendOnlyAvailable = Boolean(config["send_only_available"] ?? true)
    const sendOnlyWithPhotos = Boolean(config["send_only_with_photos"] ?? true)

    const { data: properties, error: propertiesError } = await auth.supabase
      .from("properties")
      .select("id,title,description,price,type,status,images,image_paths,address,features,hide_from_site")
      .eq("organization_id", auth.profile.organization_id)

    if (propertiesError) {
      return {
        success: false,
        error: propertiesError.message || "Não foi possível carregar os imóveis para análise.",
      }
    }

    const rows = (properties as PropertyRowForIssues[] | null) ?? []
    const nextIssues: Omit<PortalIntegrationIssueRow, "id" | "created_at" | "resolved_at" | "is_resolved">[] =
      parsed.data.portal === "imovelweb"
        ? getImovelwebReadinessIssues(rows, config, {
            sendOnlyAvailable,
            sendOnlyWithPhotos,
          }).map((issue) => ({
            organization_id: auth.profile.organization_id,
            portal: parsed.data.portal,
            property_id: issue.propertyId,
            severity: issue.severity,
            issue_key: issue.issueKey,
            message_human: issue.messageHuman,
            message_technical: null,
          }))
        : buildGenericPortalIssues(rows, auth.profile.organization_id, parsed.data.portal, {
            sendOnlyAvailable,
            sendOnlyWithPhotos,
          })

    const { data: oldIssues, error: oldIssuesError } = await auth.supabase
      .from("portal_integration_issues")
      .select("id")
      .eq("organization_id", auth.profile.organization_id)
      .eq("portal", parsed.data.portal)

    if (oldIssuesError) {
      return {
        success: false,
        error: oldIssuesError.message || "Não foi possível carregar as pendências antigas.",
      }
    }

    const oldIds = oldIssues?.map((i) => i.id) ?? []

    if (nextIssues.length > 0) {
      const { error: insertError } = await auth.supabase.from("portal_integration_issues").insert(
        nextIssues.map((issue) => ({
          ...issue,
          is_resolved: false,
        }))
      )

      if (insertError) {
        return {
          success: false,
          error: insertError.message || "Não foi possível registrar as novas pendências.",
        }
      }
    }

    if (oldIds.length > 0) {
      const step = 500
      for (let i = 0; i < oldIds.length; i += step) {
        const chunk = oldIds.slice(i, i + step)
        const { error: deleteError } = await auth.supabase
          .from("portal_integration_issues")
          .delete()
          .in("id", chunk)
          
        if (deleteError) {
          console.error("Falha ao remover lote de pendências antigas:", deleteError)
        }
      }
    }

    const blockerCount = nextIssues.filter((issue) => issue.severity === "blocker").length
    const warningCount = nextIssues.filter((issue) => issue.severity === "warning").length

    const { error: runError } = await auth.supabase.from("portal_integration_runs").insert({
      organization_id: auth.profile.organization_id,
      portal: parsed.data.portal,
      kind: "sync",
      status: "ok",
      properties_count: nextIssues.length,
      bytes: 0,
      content_type: null,
      message: `Análise de pendências: ${blockerCount} bloqueiam, ${warningCount} recomendadas.`,
    })

    if (runError) {
      return {
        success: false,
        error: runError.message || "Não foi possível registrar o resultado da análise.",
      }
    }

    revalidateIntegrationPaths(parsed.data.portal)
    return {
      success: true,
      data: {
        totalIssues: nextIssues.length,
        blockerCount,
        warningCount,
      },
    }
  } catch (error) {
    console.error("Error analyzing portal integration issues:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível analisar as pendências do portal.",
    }
  }
}
