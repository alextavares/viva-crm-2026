"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { deriveStoragePathsForBucket } from "@/lib/media"
import {
  PROPERTY_PORTAL_BULK_ACTIONS,
  propertySchema,
  type ActionResult,
  type BulkPropertyEnrichmentSummary,
  type BulkPropertyMutationSummary,
  type PropertyFormValues,
  type PropertyPortalBulkAction,
} from "@/lib/types"
import { buildSuggestedPropertyDescription, buildSuggestedPropertyTitle } from "@/lib/property-marketing"
import { decodePropertyFeatures, encodePropertyFeatures } from "@/lib/properties/features-codec"
import { generatePropertyPublicCode } from "@/lib/properties/public-code"
import { getPropertyOperationalSnapshot } from "@/lib/property-operational-readiness"

async function getPropertyActionContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { supabase, error: "Não autenticado." } as const
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single()

  if (!profile?.organization_id) {
    return {
      supabase,
      error: "Sem permissão para alterar a publicação dos imóveis.",
    } as const
  }

  return {
    supabase,
    userId: user.id,
    organizationId: profile.organization_id,
    role: profile.role ?? null,
  } as const
}

function sanitizePropertyIds(propertyIds: string[]) {
  return Array.from(new Set(propertyIds.map((id) => id.trim()).filter(Boolean)))
}

function revalidatePropertySurfaces() {
  revalidatePath("/dashboard")
  revalidatePath("/properties")
}

const savePropertySchema = propertySchema.extend({
  id: z.string().optional(),
})

const createPropertyOwnerContactSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres."),
  phone: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
})

type SavePropertyInput = PropertyFormValues & { id?: string }

type ExistingPropertyRecord = {
  id: string
  owner_contact_id: string | null
  owner_name: string | null
}

async function resolvePropertyOwnerName(input: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  ownerContactId: string | null
  existingProperty: ExistingPropertyRecord | null
}) {
  const { supabase, organizationId, ownerContactId, existingProperty } = input
  if (!ownerContactId) {
    return { ownerName: null } as const
  }

  const { data: ownerContact, error: ownerContactError } = await supabase
    .from("contacts")
    .select("id, name")
    .eq("id", ownerContactId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (ownerContactError) {
    return {
      error: ownerContactError.message || "Não foi possível validar o proprietário selecionado.",
    } as const
  }

  if (ownerContact?.id) {
    return { ownerName: ownerContact.name?.trim() || null } as const
  }

  if (existingProperty?.owner_contact_id === ownerContactId) {
    return { ownerName: existingProperty.owner_name?.trim() || null } as const
  }

  return { error: "Contato proprietário não encontrado nesta organização." } as const
}

function buildPropertyAddress(input: PropertyFormValues) {
  const base = [input.address_street, input.address_number ? `, ${input.address_number}` : ""].join("")
  const locality = [input.address_neighborhood, input.address_city, input.address_state]
    .filter(Boolean)
    .join(" - ")
  const zip = input.address_zip ? `CEP ${input.address_zip}` : ""
  const computedFullAddress =
    input.address_full?.trim() || [base, locality, zip].filter(Boolean).join(" | ").trim()

  return {
    full_address: computedFullAddress || null,
    street: input.address_street || null,
    number: input.address_number || null,
    neighborhood: input.address_neighborhood || null,
    city: input.address_city || null,
    state: input.address_state || null,
    zip: input.address_zip || null,
    country: input.address_country || null,
  }
}

export async function createPropertyOwnerContact(input: {
  name: string
  phone?: string
  email?: string
}): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const parsed = createPropertyOwnerContactSchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Dados inválidos para criar proprietário.",
      }
    }

    const context = await getPropertyActionContext()
    if ("error" in context) {
      return { success: false, error: context.error ?? "Sem permissão." }
    }

    const { supabase, organizationId, userId } = context
    const email = parsed.data.email.trim()
    if (email && !z.string().email().safeParse(email).success) {
      return { success: false, error: "Email inválido." }
    }

    const contactId = crypto.randomUUID()
    const { error } = await supabase.from("contacts").insert({
      id: contactId,
      organization_id: organizationId,
      assigned_to: userId,
      name: parsed.data.name.trim(),
      phone: parsed.data.phone.trim() || null,
      email: email || null,
      city: null,
      type: "owner",
      status: "new",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (error) {
      return {
        success: false,
        error: error.message || "Não foi possível criar o proprietário.",
      }
    }

    revalidatePath("/contacts")
    revalidatePath("/properties")

    return {
      success: true,
      data: {
        id: contactId,
        name: parsed.data.name.trim(),
      },
    }
  } catch (error) {
    console.error("Unexpected property owner creation error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível criar o proprietário.",
    }
  }
}

export async function saveProperty(input: SavePropertyInput): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = savePropertySchema.safeParse(input)
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Dados inválidos. Revise os campos do imóvel.",
      }
    }

    const context = await getPropertyActionContext()
    if ("error" in context) {
      return { success: false, error: context.error ?? "Sem permissão." }
    }

    const { supabase, organizationId, userId } = context
    const data = parsed.data
    let existingProperty: ExistingPropertyRecord | null = null

    if (data.id) {
      const { data: currentProperty, error: currentPropertyError } = await supabase
        .from("properties")
        .select("id, owner_contact_id, owner_name")
        .eq("id", data.id)
        .eq("organization_id", organizationId)
        .maybeSingle()

      if (currentPropertyError) {
        return {
          success: false,
          error: currentPropertyError.message || "Não foi possível carregar o imóvel para edição.",
        }
      }

      if (!currentProperty?.id) {
        return {
          success: false,
          error: "Imóvel não encontrado nesta organização.",
        }
      }

      existingProperty = currentProperty
    }

    const ownerResolution = await resolvePropertyOwnerName({
      supabase,
      organizationId,
      ownerContactId: data.owner_contact_id || null,
      existingProperty,
    })
    if ("error" in ownerResolution) {
      return { success: false, error: ownerResolution.error ?? "Contato proprietário não encontrado nesta organização." }
    }

    const payload = {
      title: data.title,
      description: data.description || "",
      price: data.price,
      type: data.type,
      transaction_type: data.transaction_type,
      assigned_to: data.assigned_to || userId,
      owner_contact_id: data.owner_contact_id || null,
      owner_name: ownerResolution.ownerName,
      status: data.status,
      publish_to_site: !Boolean(data.hide_from_site),
      publish_to_portals: Boolean(data.publish_to_portals),
      publish_zap: Boolean(data.publish_zap),
      publish_imovelweb: Boolean(data.publish_imovelweb),
      publish_olx: Boolean(data.publish_olx),
      features: encodePropertyFeatures({
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        area: data.area,
      }),
      address: buildPropertyAddress(data),
      image_paths: deriveStoragePathsForBucket(data.images, "properties"),
      updated_at: new Date().toISOString(),
    }

    if (data.id) {
      const { data: updatedProperty, error: updateError } = await supabase
        .from("properties")
        .update(payload)
        .eq("id", data.id)
        .eq("organization_id", organizationId)
        .select("id")
        .maybeSingle()

      if (updateError) {
        return {
          success: false,
          error: updateError.message || "Não foi possível atualizar o imóvel.",
        }
      }

      if (!updatedProperty?.id) {
        return {
          success: false,
          error: "O imóvel não foi atualizado. Recarregue a página e tente novamente.",
        }
      }

      revalidatePropertySurfaces()
      revalidatePath(`/properties/${updatedProperty.id}`)

      return {
        success: true,
        data: { id: updatedProperty.id },
      }
    }

    let createdProperty: { id: string } | null = null
    let insertError: { code?: string, message?: string } | null = null
    for (let attempt = 0; attempt < 2 && !createdProperty; attempt += 1) {
      const { data, error } = await supabase
        .from("properties")
        .insert({
          ...payload,
          organization_id: organizationId,
          public_code: generatePropertyPublicCode(),
        })
        .select("id")
        .maybeSingle()
      createdProperty = data ?? null
      insertError = error ?? null
      if (insertError && insertError.code !== "23505") break
    }

    if (insertError) {
      return {
        success: false,
        error: insertError.message || "Não foi possível cadastrar o imóvel.",
      }
    }

    if (!createdProperty?.id) {
      return {
        success: false,
        error: "O imóvel não foi criado. Recarregue a página e tente novamente.",
      }
    }

    revalidatePropertySurfaces()
    revalidatePath(`/properties/${createdProperty.id}`)

    return {
      success: true,
      data: { id: createdProperty.id },
    }
  } catch (error) {
    console.error("Unexpected property save action error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível salvar o imóvel.",
    }
  }
}

export async function updatePropertySiteVisibility(input: {
  propertyId: string
  hideFromSite: boolean
}): Promise<ActionResult<{ hideFromSite: boolean }>> {
  try {
    const context = await getPropertyActionContext()
    if ("error" in context) {
      return { success: false, error: context.error ?? "Sem permissão." }
    }
    const { supabase, organizationId } = context

    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id, organization_id")
      .eq("id", input.propertyId)
      .eq("organization_id", organizationId)
      .single()

    if (propertyError || !property?.id) {
      return { success: false, error: "Imóvel não encontrado nesta organização." }
    }

    const { data: updatedProperty, error: updateError } = await supabase
      .from("properties")
      .update({
        publish_to_site: !input.hideFromSite,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.propertyId)
      .eq("organization_id", organizationId)
      .select("id")
      .single()

    if (updateError) {
      console.error("Property visibility action error:", updateError)
      return {
        success: false,
        error: updateError.message || "Não foi possível atualizar a visibilidade do imóvel.",
      }
    }

    if (!updatedProperty?.id) {
      return { success: false, error: "O imóvel não foi atualizado." }
    }

    revalidatePropertySurfaces()
    revalidatePath(`/properties/${input.propertyId}`)

    return {
      success: true,
      data: { hideFromSite: input.hideFromSite },
    }
  } catch (error) {
    console.error("Unexpected property visibility action error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar a visibilidade do imóvel.",
    }
  }
}

export async function updateBulkPropertySiteVisibility(input: {
  propertyIds: string[]
  hideFromSite: boolean
}): Promise<ActionResult<BulkPropertyMutationSummary>> {
  try {
    const propertyIds = sanitizePropertyIds(input.propertyIds)
    if (propertyIds.length === 0) {
      return { success: false, error: "Selecione ao menos um imóvel." }
    }

    const context = await getPropertyActionContext()
    if ("error" in context) {
      return { success: false, error: context.error ?? "Sem permissão." }
    }
    const { supabase, organizationId, role } = context
    if (role !== "owner" && role !== "manager") {
      return { success: false, error: "Apenas gestores podem publicar imóveis em lote." }
    }

    const { data: updatedRows, error } = await supabase
      .from("properties")
      .update({
        // Canonical mapping: legacy `hide_from_site` inverts onto
        // `publish_to_site`.
        publish_to_site: !input.hideFromSite,
        updated_at: new Date().toISOString(),
      })
      .in("id", propertyIds)
      .eq("organization_id", organizationId)
      .select("id")

    if (error) {
      console.error("Bulk property site visibility action error:", error)
      return {
        success: false,
        error: error.message || "Não foi possível atualizar a visibilidade em lote.",
      }
    }

    const updatedCount = updatedRows?.length ?? 0
    if (updatedCount !== propertyIds.length) {
      return {
        success: false,
        error: `Só ${updatedCount} de ${propertyIds.length} imóveis foram atualizados. Revise a seleção e tente novamente.`,
      }
    }

    revalidatePropertySurfaces()

    return {
      success: true,
      data: {
        requestedCount: propertyIds.length,
        updatedCount,
      },
    }
  } catch (error) {
    console.error("Unexpected bulk property site visibility action error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar a visibilidade em lote.",
    }
  }
}

function buildPortalUpdatePayload(action: PropertyPortalBulkAction) {
  switch (action) {
    case "enable_all_portals":
      return {
        publish_to_portals: true,
        publish_zap: true,
        publish_imovelweb: true,
        publish_olx: true,
      }
    case "disable_all_portals":
      return {
        publish_to_portals: false,
        publish_zap: false,
        publish_imovelweb: false,
        publish_olx: false,
      }
    case "enable_imovelweb":
      return {
        publish_to_portals: true,
        publish_imovelweb: true,
      }
    case "enable_zap":
      return {
        publish_to_portals: true,
        publish_zap: true,
      }
    case "enable_olx":
      return {
        publish_to_portals: true,
        publish_olx: true,
      }
  }
}

export async function updateBulkPropertyPortalPublishing(input: {
  propertyIds: string[]
  action: PropertyPortalBulkAction
}): Promise<ActionResult<BulkPropertyMutationSummary>> {
  try {
    const propertyIds = sanitizePropertyIds(input.propertyIds)
    if (propertyIds.length === 0) {
      return { success: false, error: "Selecione ao menos um imóvel." }
    }

    if (!PROPERTY_PORTAL_BULK_ACTIONS.includes(input.action)) {
      return { success: false, error: "Ação de portais inválida." }
    }

    const context = await getPropertyActionContext()
    if ("error" in context) {
      return { success: false, error: context.error ?? "Sem permissão." }
    }
    const { supabase, organizationId, role } = context
    if (role !== "owner" && role !== "manager") {
      return { success: false, error: "Apenas gestores podem alterar portais em lote." }
    }

    const { data: updatedRows, error } = await supabase
      .from("properties")
      .update({
        ...buildPortalUpdatePayload(input.action),
        updated_at: new Date().toISOString(),
      })
      .in("id", propertyIds)
      .eq("organization_id", organizationId)
      .select("id")

    if (error) {
      console.error("Bulk property portal action error:", error)
      return {
        success: false,
        error: error.message || "Não foi possível atualizar os portais em lote.",
      }
    }

    const updatedCount = updatedRows?.length ?? 0
    if (updatedCount !== propertyIds.length) {
      return {
        success: false,
        error: `Só ${updatedCount} de ${propertyIds.length} imóveis tiveram os portais atualizados. Revise a seleção e tente novamente.`,
      }
    }

    revalidatePropertySurfaces()

    return {
      success: true,
      data: {
        requestedCount: propertyIds.length,
        updatedCount,
      },
    }
  } catch (error) {
    console.error("Unexpected bulk property portal action error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar os portais em lote.",
    }
  }
}

export async function updateBulkPropertyAssignee(input: {
  propertyIds: string[]
  assignedTo: string | null
}): Promise<ActionResult<BulkPropertyMutationSummary>> {
  try {
    const propertyIds = sanitizePropertyIds(input.propertyIds)
    if (propertyIds.length === 0) {
      return { success: false, error: "Selecione ao menos um imóvel." }
    }

    const context = await getPropertyActionContext()
    if ("error" in context) {
      return { success: false, error: context.error ?? "Sem permissão." }
    }
    const { supabase, organizationId, role } = context
    if (role !== "owner" && role !== "manager") {
      return { success: false, error: "Apenas gestores podem atribuir responsável em lote." }
    }

    const { data: updatedRows, error } = await supabase
      .from("properties")
      .update({
        assigned_to: input.assignedTo,
        updated_at: new Date().toISOString(),
      })
      .in("id", propertyIds)
      .eq("organization_id", organizationId)
      .select("id")

    if (error) {
      console.error("Bulk property assignee action error:", error)
      return {
        success: false,
        error: error.message || "Não foi possível atualizar o responsável em lote.",
      }
    }

    const updatedCount = updatedRows?.length ?? 0
    if (updatedCount !== propertyIds.length) {
      return {
        success: false,
        error: `Só ${updatedCount} de ${propertyIds.length} imóveis foram atualizados. Revise a seleção e tente novamente.`,
      }
    }

    revalidatePropertySurfaces()

    return {
      success: true,
      data: {
        requestedCount: propertyIds.length,
        updatedCount,
      },
    }
  } catch (error) {
    console.error("Unexpected bulk property assignee action error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível atualizar o responsável em lote.",
    }
  }
}

export async function updateBulkPropertyCommercialEnrichment(input: {
  propertyIds: string[]
}): Promise<ActionResult<BulkPropertyEnrichmentSummary>> {
  try {
    const propertyIds = sanitizePropertyIds(input.propertyIds)
    if (propertyIds.length === 0) {
      return { success: false, error: "Selecione ao menos um imóvel." }
    }

    const context = await getPropertyActionContext()
    if ("error" in context) {
      return { success: false, error: context.error ?? "Sem permissão." }
    }
    const { supabase, organizationId, role } = context
    if (role !== "owner" && role !== "manager") {
      return { success: false, error: "Apenas gestores podem enriquecer anúncios em lote." }
    }

    const { data: properties, error: fetchError } = await supabase
      .from("properties")
      .select(
        "id, title, description, type, transaction_type, built_area, total_area, features, address, image_paths, price, status, publish_to_site"
      )
      .in("id", propertyIds)
      .eq("organization_id", organizationId)

    if (fetchError) {
      console.error("Bulk property enrichment fetch error:", fetchError)
      return {
        success: false,
        error: fetchError.message || "Não foi possível carregar os imóveis selecionados.",
      }
    }

    const updates = (properties || [])
      .map((property) => {
        const snapshot = getPropertyOperationalSnapshot(property)
        const decodedFeatures = decodePropertyFeatures(property.features)
        const needsWeakTitle = snapshot.lightIssues.some((issue) => issue.code === "weak_title")
        const needsDescription = [...snapshot.criticalIssues, ...snapshot.lightIssues].some(
          (issue) => issue.code === "missing_description" || issue.code === "weak_description"
        )
        const suggestedTitle = needsWeakTitle
          ?           buildSuggestedPropertyTitle({
            type: property.type,
            transactionType: property.transaction_type,
            bedrooms: decodedFeatures.bedrooms || null,
            neighborhood: property.address?.neighborhood ?? null,
            city: property.address?.city ?? null,
          })
          : null
        const suggestedDescription = buildSuggestedPropertyDescription({
          type: property.type,
          transactionType: property.transaction_type,
          bedrooms: decodedFeatures.bedrooms || null,
          bathrooms: decodedFeatures.bathrooms || null,
          area: decodedFeatures.area || property.built_area || property.total_area || null,
          neighborhood: property.address?.neighborhood ?? null,
          city: property.address?.city ?? null,
        })
        const currentTitle = property.title?.trim() ?? ""
        const currentDescription = property.description?.trim() ?? ""

        const payload: Record<string, string> = {}
        if (needsWeakTitle && suggestedTitle && currentTitle && currentTitle !== suggestedTitle) {
          payload.title = suggestedTitle
        }
        if (needsDescription && suggestedDescription && currentDescription !== suggestedDescription) {
          payload.description = suggestedDescription
        }

        if (Object.keys(payload).length === 0) return null
        return { id: property.id, payload }
      })
      .filter((update): update is { id: string; payload: Record<string, string> } => Boolean(update))

    const skippedCount = propertyIds.length - updates.length
    if (updates.length === 0) {
      return {
        success: true,
        data: {
          requestedCount: propertyIds.length,
          updatedCount: 0,
          skippedCount,
        },
      }
    }

    const updateResults = await Promise.all(
      updates.map((update) =>
        supabase
          .from("properties")
          .update({
            ...update.payload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", update.id)
          .eq("organization_id", organizationId)
          .select("id")
          .single()
      )
    )

    const failed = updateResults.find((result) => result.error)
    if (failed?.error) {
      console.error("Bulk property enrichment update error:", failed.error)
      return {
        success: false,
        error: failed.error.message || "Não foi possível atualizar os anúncios selecionados.",
      }
    }

    const updatedCount = updateResults.filter((result) => result.data?.id).length
    if (updatedCount !== updates.length) {
      return {
        success: false,
        error: `Só ${updatedCount} de ${updates.length} imóveis foram enriquecidos. Revise a seleção e tente novamente.`,
      }
    }

    revalidatePropertySurfaces()

    return {
      success: true,
      data: {
        requestedCount: propertyIds.length,
        updatedCount,
        skippedCount,
      },
    }
  } catch (error) {
    console.error("Unexpected bulk property enrichment action error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Não foi possível aplicar o enriquecimento comercial em lote.",
    }
  }
}
