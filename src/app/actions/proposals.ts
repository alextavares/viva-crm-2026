"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { proposalSchema } from "@/lib/types"

export async function saveProposal(formData: FormData) {
    const supabase = await createClient()

    const rawData = {
        property_id: formData.get("property_id") as string,
        proposed_value: formData.get("proposed_value"),
        payment_conditions: formData.get("payment_conditions") as string,
        valid_until: formData.get("valid_until") as string,
        status: formData.get("status") as string,
        notes: formData.get("notes") as string,
    }

    const parsed = proposalSchema.safeParse(rawData)
    if (!parsed.success) {
        return { error: "Dados inválidos: verifique os campos da proposta." }
    }

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return { error: "Não autenticado" }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", userData.user.id)
        .single()

    if (!profile?.organization_id) return { error: "Sem permissão" }

    const role = (profile.role as string | null) ?? null
    if (role !== "owner" && role !== "manager") {
        return { error: "Apenas gestores podem criar ou editar propostas." }
    }

    const id = formData.get("id") as string | null
    const contactId = formData.get("contact_id") as string
    const brokerId = formData.get("broker_id") as string | null
    const orgId = profile.organization_id

    // Validate contact belongs to the same organization
    const { data: contactCheck } = await supabase
        .from("contacts")
        .select("id")
        .eq("id", contactId)
        .eq("organization_id", orgId)
        .single()

    if (!contactCheck) {
        return { error: "Contato não encontrado nesta organização." }
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
            return { error: "Imóvel não encontrado nesta organização." }
        }
    }

    const payload = {
        organization_id: orgId,
        contact_id: contactId,
        broker_id: brokerId || null,
        property_id: parsed.data.property_id || null,
        proposed_value: parsed.data.proposed_value,
        payment_conditions: parsed.data.payment_conditions || null,
        valid_until: parsed.data.valid_until || null,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
        updated_at: new Date().toISOString()
    }

    let proposalId = id;

    if (id) {
        // Bloquear edição se já existe contrato
        const { data: existingContract } = await supabase
            .from("deal_contracts")
            .select("id")
            .eq("proposal_id", id)
            .single()

        if (existingContract) {
            return { error: "Esta proposta já gerou um contrato e não pode mais ser editada." }
        }

        // Atualizar
        const { error } = await supabase
            .from("deal_proposals")
            .update(payload)
            .eq("id", id)
            .eq("organization_id", orgId)

        if (error) {
            console.error("Erro ao atualizar proposta:", error)
            return { error: "Erro ao atualizar proposta no banco de dados." }
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
            return { error: "Erro ao criar proposta no banco de dados." }
        }

        proposalId = data.id;
    }

    // Auto-create contract draft if accepted
    if (parsed.data.status === "accepted" && parsed.data.property_id) {
        // Check if a contract for this proposal already exists to avoid duplicates
        const { data: existingContract } = await supabase
            .from("deal_contracts")
            .select("id")
            .eq("proposal_id", proposalId)
            .single()

        if (!existingContract && proposalId) {
            const { error: contractError } = await supabase
                .from("deal_contracts")
                .insert([{
                    organization_id: orgId,
                    proposal_id: proposalId,
                    contact_id: contactId,
                    property_id: parsed.data.property_id,
                    broker_id: brokerId || null,
                    contract_type: 'sale', // Defaulting to sale based on context, user can edit later
                    final_value: parsed.data.proposed_value,
                    status: 'draft',
                    created_at: new Date().toISOString()
                }])

            if (contractError) {
                console.error("Erro ao auto-gerar contrato:", contractError)
                // We don't fail the proposal transaction, but log it
            }
        }
    }

    revalidatePath(`/contacts/${contactId}`)
    return { success: true }
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
    if (role !== "owner" && role !== "manager") {
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
