"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { isAdmin, type ActionResult } from "@/lib/types"
import {
    applyContactFollowupActionForOrganization,
    processFollowupsForOrganization,
    redistributeOverdueLeadsForOrganization,
    type ContactFollowupActionType,
    type FollowupProcessSummary,
    type LeadRedistributionSummary,
} from "@/lib/followups/operations"

const limitSchema = z.coerce.number().int().min(1).max(500).optional()
const contactFollowupActionSchema = z.object({
    contactId: z.string().uuid("Contato inválido para a régua."),
    action: z.enum(["pause", "resume", "cancel"]),
})

async function getAdminActionContext() {
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

    if (!isAdmin(profile.role)) {
        return { supabase, error: "Apenas gestores podem executar esta ação." } as const
    }

    return { supabase, user, profile } as const
}

function revalidateFollowupPaths(contactId?: string) {
    revalidatePath("/settings/followup")
    revalidatePath("/contacts")
    revalidatePath("/contacts/site")
    revalidatePath("/dashboard")
    if (contactId) {
        revalidatePath(`/contacts/${contactId}`)
    }
}

function revalidateLeadDistributionPaths() {
    revalidatePath("/settings/leads")
    revalidatePath("/contacts")
    revalidatePath("/contacts/site")
    revalidatePath("/dashboard")
}

export async function processFollowupsNow(
    limit?: number
): Promise<ActionResult<FollowupProcessSummary>> {
    try {
        const parsedLimit = limitSchema.safeParse(limit)
        if (!parsedLimit.success) {
            return { success: false, error: "Limite inválido para processar follow-ups." }
        }

        const auth = await getAdminActionContext()
        if ("error" in auth) {
            return { success: false, error: auth.error ?? "Sem permissão." }
        }

        const result = await processFollowupsForOrganization(
            auth.supabase,
            auth.profile.organization_id,
            parsedLimit.data ?? 50
        )

        if (!result.success) {
            return result
        }

        revalidateFollowupPaths()
        return result
    } catch (error) {
        console.error("Unexpected processFollowupsNow error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao processar follow-ups.",
        }
    }
}

export async function redistributeOverdueLeadsNow(
    limit?: number
): Promise<ActionResult<LeadRedistributionSummary>> {
    try {
        const parsedLimit = limitSchema.safeParse(limit)
        if (!parsedLimit.success) {
            return { success: false, error: "Limite inválido para redistribuição de leads." }
        }

        const auth = await getAdminActionContext()
        if ("error" in auth) {
            return { success: false, error: auth.error ?? "Sem permissão." }
        }

        const result = await redistributeOverdueLeadsForOrganization(
            auth.supabase,
            auth.profile.organization_id,
            parsedLimit.data ?? 50
        )

        if (!result.success) {
            return result
        }

        revalidateLeadDistributionPaths()
        return result
    } catch (error) {
        console.error("Unexpected redistributeOverdueLeadsNow error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao redistribuir leads atrasados.",
        }
    }
}

export async function applyContactFollowupAction(
    contactId: string,
    action: ContactFollowupActionType
): Promise<ActionResult<{ action: ContactFollowupActionType; affected: number }>> {
    try {
        const parsed = contactFollowupActionSchema.safeParse({ contactId, action })
        if (!parsed.success) {
            return {
                success: false,
                error: parsed.error.issues[0]?.message || "Ação inválida para a régua de follow-up.",
            }
        }

        const auth = await getAdminActionContext()
        if ("error" in auth) {
            return { success: false, error: auth.error ?? "Sem permissão." }
        }

        const result = await applyContactFollowupActionForOrganization(
            auth.supabase,
            auth.profile.organization_id,
            parsed.data.contactId,
            parsed.data.action
        )

        if (!result.success) {
            return result
        }

        revalidateFollowupPaths(parsed.data.contactId)
        return result
    } catch (error) {
        console.error("Unexpected applyContactFollowupAction error:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao atualizar a régua do contato.",
        }
    }
}
