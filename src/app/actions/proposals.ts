"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
    type ActionResult,
    canCreateProposalForContact,
    canDeleteProposalRecord,
    canEditProposalRecord,
    proposalSchema,
} from "@/lib/types"

function formatDbError(prefix: string, error: unknown) {
    if (typeof error === "object" && error !== null) {
        const message = "message" in error && typeof error.message === "string" ? error.message : null
        const details = "details" in error && typeof error.details === "string" ? error.details : null
        const hint = "hint" in error && typeof error.hint === "string" ? error.hint : null
        const code = "code" in error && typeof error.code === "string" ? error.code : null
        const suffix = [message, details, hint, code ? `código ${code}` : null].filter(Boolean).join(" | ")
        if (suffix) return `${prefix}: ${suffix}`
    }

    if (error instanceof Error && error.message) {
        return `${prefix}: ${error.message}`
    }

    return prefix
}

export async function saveProposal(formData: FormData): Promise<ActionResult<{ id: string }>> {
    try {
    const supabase = await createClient()

    const rawData = {
        property_id: (formData.get("property_id") as string | null) ?? "",
        proposed_value: formData.get("proposed_value"),
        payment_conditions: (formData.get("payment_conditions") as string | null) ?? "",
        valid_until: (formData.get("valid_until") as string | null) ?? "",
        status: (formData.get("status") as string | null) ?? "pending",
        notes: (formData.get("notes") as string | null) ?? "",
    }

    const parsed = proposalSchema.safeParse(rawData)
    if (!parsed.success) {
        const firstIssue = parsed.error.issues[0]?.message
        return {
            success: false,
            error: firstIssue
                ? `Dados inválidos na proposta: ${firstIssue}`
                : "Dados inválidos: verifique os campos da proposta.",
        }
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return { success: false, error: "Não autenticado" }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", userData.user.id)
        .single()

    if (!profile?.organization_id) return { success: false, error: "Sem permissão" }

    const role = (profile.role as string | null) ?? null

    const id = formData.get("id") as string | null
    const contactId = formData.get("contact_id") as string
    const assignedTo = formData.get("assigned_to") as string | null
    const orgId = profile.organization_id

    // Validate contact belongs to the same organization
    const { data: contactCheck } = await supabase
        .from("contacts")
        .select("id, assigned_to")
        .eq("id", contactId)
        .eq("organization_id", orgId)
        .single()

    if (!contactCheck) {
        return { success: false, error: "Contato não encontrado nesta organização." }
    }

    // Validate property belongs to the same organization (if provided)
    if (parsed.data.property_id) {
        const { data: propertyCheck } = await supabase
            .from("properties")
            .select("id")
            .eq("id", parsed.data.property_id)
            .eq("organization_id", orgId)
            .single()

        if (!propertyCheck) {
            return { success: false, error: "Imóvel não encontrado nesta organização." }
        }
    }

    let effectiveAssignedTo = assignedTo || null

    if (!id) {
        if (!canCreateProposalForContact(role, userData.user.id, contactCheck.assigned_to)) {
            return { success: false, error: "Você não pode criar proposta para este contato." }
        }
        if (role === "broker") {
            effectiveAssignedTo = userData.user.id
        }
    } else {
        const { data: existingProposal } = await supabase
            .from("deal_proposals")
            .select("id, assigned_to")
            .eq("id", id)
            .eq("organization_id", orgId)
            .single()

        if (!existingProposal) {
            return { success: false, error: "Proposta não encontrada nesta organização." }
        }

        if (!canEditProposalRecord(role, userData.user.id, existingProposal.assigned_to)) {
            return { success: false, error: "Você não pode editar esta proposta." }
        }

        if (role === "broker") {
            effectiveAssignedTo = userData.user.id
        } else {
            effectiveAssignedTo = assignedTo || existingProposal.assigned_to || null
        }
    }

    const payload = {
        organization_id: orgId,
        contact_id: contactId,
        assigned_to: effectiveAssignedTo,
        property_id: parsed.data.property_id || null,
        proposed_value: parsed.data.proposed_value,
        payment_conditions: parsed.data.payment_conditions || null,
        valid_until: parsed.data.valid_until || null,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
        updated_at: new Date().toISOString()
    }

    let proposalId = id
    let linkedContractStatus: string | null = null

    if (id) {
        // Bloquear edição se já existe contrato
        const { data: existingContract } = await supabase
            .from("deal_contracts")
            .select("id")
            .eq("proposal_id", id)
            .single()

        if (existingContract) {
            return { success: false, error: "Esta proposta já gerou um contrato e não pode mais ser editada." }
        }

        // Atualizar
        const { error } = await supabase
            .from("deal_proposals")
            .update(payload)
            .eq("id", id)
            .eq("organization_id", orgId)

        if (error) {
            console.error("Erro ao atualizar proposta:", error)
            return { success: false, error: formatDbError("Erro ao atualizar proposta", error) }
        }
    } else {
        // Criar
        const { data, error } = await supabase
            .from("deal_proposals")
            .insert([{ ...payload, created_at: new Date().toISOString() }])
            .select()
            .single()

        if (error) {
            console.error("Erro ao criar proposta:", error)
            return { success: false, error: formatDbError("Erro ao criar proposta", error) }
        }

        proposalId = data.id
    }

    // Auto-create contract draft if accepted
    if (parsed.data.status === "accepted" && parsed.data.property_id) {
        // Check if a contract for this proposal already exists to avoid duplicates
        const { data: existingContract } = await supabase
            .from("deal_contracts")
            .select("id, status")
            .eq("proposal_id", proposalId)
            .single()

        if (existingContract) {
            linkedContractStatus = existingContract.status ?? "draft"
        } else if (proposalId) {
            const { data: createdContract, error: contractError } = await supabase
                .from("deal_contracts")
                .insert([{
                    organization_id: orgId,
                    proposal_id: proposalId,
                    contact_id: contactId,
                    property_id: parsed.data.property_id,
                    assigned_to: effectiveAssignedTo,
                    contract_type: 'sale', // Defaulting to sale based on context, user can edit later
                    final_value: parsed.data.proposed_value,
                    status: 'draft',
                    created_at: new Date().toISOString()
                }])
                .select("id, status")
                .single()

            if (contractError) {
                console.error("Erro ao auto-gerar contrato:", contractError)
                // We don't fail the proposal transaction, but log it
            } else {
                linkedContractStatus = createdContract?.status ?? "draft"
            }
        }
    }

    revalidatePath(`/contacts/${contactId}`)
    if (linkedContractStatus) {
        revalidatePath("/contracts")
    }
    return { success: true, data: { id: proposalId ?? id ?? "" } }
    } catch (error) {
        console.error("Unexpected error saving proposal:", error)
        return {
            success: false,
            error: formatDbError("Erro ao salvar proposta", error),
        }
    }
}

export async function deleteProposal(proposalId: string, contactId: string) {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Não autenticado" }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) return { error: "Sem permissão" }

    const role = (profile.role as string | null) ?? null
    if (!canDeleteProposalRecord(role)) {
        return { error: "Apenas gestores podem excluir propostas." }
    }

    const { data: existingContract } = await supabase
        .from("deal_contracts")
        .select("id")
        .eq("proposal_id", proposalId)
        .single()

    if (existingContract) {
        return { error: "Não é possível excluir uma proposta que já possui contrato gerado." }
    }

    const { error } = await supabase
        .from("deal_proposals")
        .delete()
        .eq("id", proposalId)
        .eq("organization_id", profile.organization_id)

    if (error) {
        console.error("Erro ao deletar proposta:", error)
        return { error: "Erro ao deletar proposta" }
    }

    revalidatePath(`/contacts/${contactId}`)
    return { success: true }
}
