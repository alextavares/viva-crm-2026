"use server"

import { createClient } from "@/lib/supabase/server"
import { contractSchema, type DealContract } from "@/lib/types"
import { revalidatePath } from "next/cache"

export async function saveContract(data: Partial<DealContract>) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { error: "Sem permissão" }
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id, role")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return { error: "Sem permissão" }
        }

        const role = (profile.role as string | null) ?? null
        if (role !== "owner" && role !== "manager") {
            return { error: "Apenas gestores podem criar ou editar contratos." }
        }

        const validData = contractSchema.parse({
            ...data,
            organization_id: profile.organization_id,
        })

        if (validData.id) {
            // Update
            const { error } = await supabase
                .from("deal_contracts")
                .update({
                    contract_type: validData.contract_type,
                    property_id: validData.property_id,
                    contact_id: validData.contact_id,
                    broker_id: validData.broker_id,
                    final_value: validData.final_value,
                    commission_value: validData.commission_value,
                    status: validData.status,
                    start_date: validData.start_date,
                    end_date: validData.end_date,
                    document_url: validData.document_url
                })
                .eq("id", validData.id)
                .eq("organization_id", profile.organization_id)

            if (error) throw error
        } else {
            // Insert
            const { error } = await supabase
                .from("deal_contracts")
                .insert([{
                    organization_id: validData.organization_id,
                    contract_type: validData.contract_type,
                    property_id: validData.property_id,
                    contact_id: validData.contact_id,
                    broker_id: validData.broker_id,
                    final_value: validData.final_value,
                    commission_value: validData.commission_value,
                    status: validData.status,
                    start_date: validData.start_date,
                    end_date: validData.end_date,
                    document_url: validData.document_url
                }])

            if (error) throw error
        }

        revalidatePath("/contracts")
        if (validData.contact_id) {
            revalidatePath(`/contacts/${validData.contact_id}`)
        }

        return { success: true }
    } catch (error: unknown) {
        console.error("Erro ao salvar contrato:", error)
        return { error: error instanceof Error ? error.message : "Ocorreu um erro ao salvar o contrato." }
    }
}

export async function deleteContract(id: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return { error: "Sem permissão" }
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id, role")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return { error: "Sem permissão" }
        }

        const role = (profile.role as string | null) ?? null
        if (role !== "owner" && role !== "manager") {
            return { error: "Apenas gestores podem excluir contratos." }
        }

        // Get contract to know contact id for revalidation later
        const { data: contract } = await supabase
            .from("deal_contracts")
            .select("contact_id")
            .eq("id", id)
            .single()

        const { error } = await supabase
            .from("deal_contracts")
            .delete()
            .eq("id", id)
            .eq("organization_id", profile.organization_id)

        if (error) throw error

        revalidatePath("/contracts")
        if (contract?.contact_id) {
            revalidatePath(`/contacts/${contract.contact_id}`)
        }

        return { success: true }
    } catch (error: unknown) {
        console.error("Erro ao deletar contrato:", error)
        return { error: error instanceof Error ? error.message : "Erro ao deletar contrato" }
    }
}
