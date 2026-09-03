"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import {
    OPPORTUNITY_STAGES,
    type ActionResult,
    type OpportunityStage,
} from "@/lib/types"
import { buildOpportunityStagePayload } from "@/lib/opportunities/stage"

const createOpportunitySchema = z.object({
    contactId: z.string().uuid(),
    propertyId: z.string().uuid().nullable().optional(),
    stage: z.enum(OPPORTUNITY_STAGES).default("new"),
    estimatedValue: z.coerce.number().nonnegative().nullable().optional(),
})

const advanceOpportunitySchema = z.object({
    opportunityId: z.string().uuid(),
    stage: z.enum(OPPORTUNITY_STAGES),
    lossReason: z.string().trim().max(500).nullable().optional(),
})

async function getOpportunityActionContext() {
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
        return { supabase, error: "Sem permissão." } as const
    }

    return { supabase, user, profile } as const
}

export async function createOpportunityFromContact(input: {
    contactId: string
    propertyId?: string | null
    stage?: OpportunityStage
    estimatedValue?: number | null
}): Promise<ActionResult<{ id: string; alreadyExisted: boolean }>> {
    const parsed = createOpportunitySchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: "Dados inválidos para criar a oportunidade." }
    }

    const context = await getOpportunityActionContext()
    if ("error" in context) {
        return { success: false, error: context.error ?? "Sem permissão." }
    }
    const { supabase, user, profile } = context

    const { data: contact } = await supabase
        .from("contacts")
        .select("id, organization_id, assigned_to")
        .eq("id", parsed.data.contactId)
        .single()

    if (!contact || contact.organization_id !== profile.organization_id) {
        return { success: false, error: "Contato não encontrado ou sem acesso." }
    }

    if (parsed.data.propertyId) {
        const { data: property } = await supabase
            .from("properties")
            .select("id")
            .eq("id", parsed.data.propertyId)
            .eq("organization_id", profile.organization_id)
            .single()

        if (!property) {
            return { success: false, error: "Imóvel não encontrado nesta organização." }
        }
    }

    const { data: openOpportunities } = await supabase
        .from("opportunities")
        .select("id, property_id")
        .eq("organization_id", profile.organization_id)
        .eq("contact_id", parsed.data.contactId)
        .is("closed_at", null)

    const wantedPropertyId = parsed.data.propertyId ?? null
    const existing = (openOpportunities ?? []).find(
        (opp) => (opp.property_id ?? null) === wantedPropertyId
    )
    if (existing) {
        return { success: true, data: { id: existing.id, alreadyExisted: true } }
    }

    const stagePatch = buildOpportunityStagePayload(null, parsed.data.stage)
    if (!stagePatch.ok) {
        return { success: false, error: stagePatch.error }
    }

    const { data: created, error } = await supabase
        .from("opportunities")
        .insert({
            organization_id: profile.organization_id,
            contact_id: parsed.data.contactId,
            property_id: wantedPropertyId,
            assigned_to: contact.assigned_to ?? user.id,
            estimated_value: parsed.data.estimatedValue ?? null,
            source: "manual",
            ...stagePatch.patch,
        })
        .select("id")
        .single()

    if (error || !created?.id) {
        return { success: false, error: error?.message || "Não foi possível criar a oportunidade." }
    }

    revalidatePath(`/contacts/${parsed.data.contactId}`)
    revalidatePath("/contacts")
    return { success: true, data: { id: created.id, alreadyExisted: false } }
}

export async function advanceOpportunityStage(input: {
    opportunityId: string
    stage: OpportunityStage
    lossReason?: string | null
}): Promise<ActionResult<{ id: string; stage: OpportunityStage }>> {
    const parsed = advanceOpportunitySchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: "Estágio inválido para a oportunidade." }
    }

    const context = await getOpportunityActionContext()
    if ("error" in context) {
        return { success: false, error: context.error ?? "Sem permissão." }
    }
    const { supabase, profile } = context

    const { data: opportunity } = await supabase
        .from("opportunities")
        .select("id, organization_id, contact_id, stage")
        .eq("id", parsed.data.opportunityId)
        .single()

    if (!opportunity || opportunity.organization_id !== profile.organization_id) {
        return { success: false, error: "Oportunidade não encontrada ou sem acesso." }
    }

    const stagePatch = buildOpportunityStagePayload(
        opportunity.stage,
        parsed.data.stage,
        parsed.data.lossReason ?? null
    )
    if (!stagePatch.ok) {
        return { success: false, error: stagePatch.error }
    }

    const { error } = await supabase
        .from("opportunities")
        .update(stagePatch.patch)
        .eq("id", parsed.data.opportunityId)
        .eq("organization_id", profile.organization_id)

    if (error) {
        return { success: false, error: error.message || "Não foi possível avançar o estágio." }
    }

    revalidatePath(`/contacts/${opportunity.contact_id}`)
    revalidatePath("/contacts")
    return { success: true, data: { id: parsed.data.opportunityId, stage: parsed.data.stage } }
}
