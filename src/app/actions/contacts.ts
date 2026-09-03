"use server"

import { createClient } from "@/lib/supabase/server"
import {
    CONTACT_STATUSES,
    contactSchema,
    interestProfileSchema,
    isAdmin,
    type ActionResult,
    type ContactStatus,
    type ContactFormValues,
    type InterestProfile,
} from "@/lib/types"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const contactInteractionSchema = z.object({
    contactId: z.string().uuid(),
    type: z.enum(["call", "email", "visit", "note", "whatsapp"]),
    direction: z.enum(["inbound", "outbound"]).nullable(),
    summary: z.string().trim().min(3, "Resumo deve ter pelo menos 3 caracteres"),
    happenedAt: z.string().datetime().optional(),
})

const contactWhatsAppTraceSchema = z.object({
    contactId: z.string().uuid(),
    summary: z.string().trim().min(3).max(500),
})

const contactStatusSchema = z.object({
    contactId: z.string().uuid(),
    status: z.enum(CONTACT_STATUSES),
})

const deleteContactSchema = z.object({
    contactId: z.string().uuid(),
})

const saveInterestProfileInputSchema = z.object({
    contact_id: z.string().uuid(),
    profile: interestProfileSchema,
})

async function getContactActionContext() {
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

export async function addContactNote(contactId: string, text: string) {
    return saveContactInteraction({
        contactId,
        type: "note",
        direction: null,
        summary: text,
    })
}

export async function saveContactInteraction(input: {
    contactId: string
    type: "call" | "email" | "visit" | "note" | "whatsapp"
    direction?: "inbound" | "outbound" | null
    summary: string
    happenedAt?: string
}) {
    const parsed = contactInteractionSchema.safeParse({
        contactId: input.contactId,
        type: input.type,
        direction: input.type === "note" ? null : (input.direction ?? "outbound"),
        summary: input.summary,
        happenedAt: input.happenedAt ?? new Date().toISOString(),
    })

    if (!parsed.success) {
        throw new Error("Invalid interaction payload")
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error("Unauthorized")
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single()

    if (!profile?.organization_id) {
        throw new Error("No organization found for user")
    }

    const { data: contact } = await supabase
        .from("contacts")
        .select("organization_id")
        .eq("id", parsed.data.contactId)
        .single()

    if (!contact || contact.organization_id !== profile.organization_id) {
        throw new Error("Contact not found or access denied")
    }

    const { error } = await supabase.from("contact_interactions").insert({
        contact_id: parsed.data.contactId,
        organization_id: profile.organization_id,
        created_by: user.id,
        type: parsed.data.type,
        direction: parsed.data.direction,
        summary: parsed.data.summary,
        happened_at: parsed.data.happenedAt ?? new Date().toISOString(),
    })

    if (error) {
        console.error("Error saving interaction:", error)
        throw new Error("Failed to save interaction")
    }

    revalidatePath(`/contacts/${parsed.data.contactId}`)
}

export async function recordExternalWhatsAppAttempt(input: {
    contactId: string
    summary: string
}): Promise<ActionResult<{ id: string }>> {
    try {
        const parsed = contactWhatsAppTraceSchema.safeParse(input)
        if (!parsed.success) {
            return { success: false, error: "Dados inválidos para registrar WhatsApp." }
        }

        const context = await getContactActionContext()
        if ("error" in context) {
            return { success: false, error: context.error ?? "Sem permissão." }
        }

        const { supabase, user, profile } = context
        const { data: contact, error: contactError } = await supabase
            .from("contacts")
            .select("id, organization_id")
            .eq("id", parsed.data.contactId)
            .eq("organization_id", profile.organization_id)
            .maybeSingle()

        if (contactError || !contact?.id) {
            return { success: false, error: "Contato não encontrado nesta organização." }
        }

        const { data: inserted, error: insertError } = await supabase
            .from("contact_interactions")
            .insert({
                contact_id: parsed.data.contactId,
                organization_id: profile.organization_id,
                created_by: user.id,
                type: "whatsapp",
                direction: "outbound",
                summary: parsed.data.summary,
                happened_at: new Date().toISOString(),
            })
            .select("id")
            .maybeSingle()

        if (insertError || !inserted?.id) {
            return {
                success: false,
                error: insertError?.message || "Não foi possível registrar WhatsApp.",
            }
        }

        revalidatePath("/contacts")
        revalidatePath("/contacts/site")
        revalidatePath(`/contacts/${parsed.data.contactId}`)
        return { success: true, data: { id: inserted.id } }
    } catch (error) {
        console.error("Unexpected external WhatsApp trace error:", error)
        return { success: false, error: "Não foi possível registrar WhatsApp." }
    }
}

export async function saveContactRecord(input: {
    id?: string
    values: ContactFormValues
}): Promise<ActionResult<{ id: string }>> {
    try {
        const supabase = await createClient()
        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return { success: false, error: "Não autenticado." }
        }

        const { data: profile } = await supabase
            .from("profiles")
            .select("organization_id")
            .eq("id", user.id)
            .single()

        if (!profile?.organization_id) {
            return { success: false, error: "Sem permissão." }
        }

        const parsed = contactSchema.safeParse({
            ...input.values,
            email: input.values.email?.trim() ?? "",
            phone: input.values.phone?.trim() ?? "",
            city: input.values.city?.trim() ?? "",
            interest_type: input.values.interest_type ?? "",
            interest_bedrooms: input.values.interest_bedrooms ?? null,
            interest_price_max: input.values.interest_price_max ?? null,
            notes: input.values.notes?.trim() ?? "",
        })

        if (!parsed.success) {
            const firstIssue = parsed.error.issues[0]?.message
            return {
                success: false,
                error: firstIssue
                    ? `Dados inválidos no contato: ${firstIssue}`
                    : "Dados inválidos no contato.",
            }
        }

        const values = parsed.data
        const payload = {
            name: values.name,
            email: values.email?.trim() || null,
            phone: values.phone?.trim() || null,
            city: values.city?.trim() || null,
            type: values.type,
            status: values.status,
            interest_type: values.interest_type || null,
            interest_bedrooms: values.interest_bedrooms ?? null,
            interest_price_max: values.interest_price_max ?? null,
            notes: values.notes?.trim() || null,
            updated_at: new Date().toISOString(),
        }

        if (input.id) {
            const { data: updatedContact, error } = await supabase
                .from("contacts")
                .update(payload)
                .eq("id", input.id)
                .eq("organization_id", profile.organization_id)
                .select("id")
                .single()

            if (error) {
                console.error("Error updating contact:", error)
                return {
                    success: false,
                    error: error.message
                        ? `Erro ao atualizar contato: ${error.message}`
                        : "Erro ao atualizar contato.",
                }
            }

            if (!updatedContact?.id) {
                return { success: false, error: "Contato não encontrado para atualização." }
            }

            revalidatePath("/contacts")
            revalidatePath("/contacts/site")
            revalidatePath(`/contacts/${input.id}`)
            return { success: true, data: { id: input.id } }
        }

        const contactId = crypto.randomUUID()
        const { error: insertError } = await supabase
            .from("contacts")
            .insert({
                id: contactId,
                ...payload,
                organization_id: profile.organization_id,
                assigned_to: user.id,
                created_at: new Date().toISOString(),
            })

        if (insertError) {
            console.error("Error creating contact:", insertError)
            return {
                success: false,
                error: insertError.message
                    ? `Erro ao criar contato: ${insertError.message}`
                    : "Erro ao criar contato.",
            }
        }

        if (values.type === "lead") {
            const { error: followupError } = await supabase.rpc("followup_schedule_sequence", {
                p_org_id: profile.organization_id,
                p_contact_id: contactId,
                p_start_at: new Date().toISOString(),
                p_source: "crm_manual",
            })

            if (followupError) {
                console.error("Error scheduling manual follow-up:", followupError)
            }
        }

        revalidatePath("/contacts")
        revalidatePath("/contacts/site")
        revalidatePath(`/contacts/${contactId}`)
        return { success: true, data: { id: contactId } }
    } catch (error: unknown) {
        console.error("Unexpected error saving contact:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao salvar contato.",
        }
    }
}

export async function updateContactStatus(
    contactId: string,
    status: string
): Promise<ActionResult<{ status: ContactStatus }>> {
    try {
        const parsed = contactStatusSchema.safeParse({ contactId, status })
        if (!parsed.success) {
            return { success: false, error: "Status inválido para o contato." }
        }

        const context = await getContactActionContext()
        if ("error" in context) {
            return { success: false, error: context.error ?? "Sem permissão." }
        }

        const { supabase, profile } = context

        const { data: contact } = await supabase
            .from("contacts")
            .select("id, organization_id")
            .eq("id", parsed.data.contactId)
            .single()

        if (!contact || contact.organization_id !== profile.organization_id) {
            return { success: false, error: "Contato não encontrado ou sem acesso." }
        }

        const { error } = await supabase
            .from("contacts")
            .update({
                status: parsed.data.status,
                updated_at: new Date().toISOString(),
            })
            .eq("id", parsed.data.contactId)
            .eq("organization_id", profile.organization_id)

        if (error) {
            console.error("Error updating contact status:", error)
            return { success: false, error: "Erro ao atualizar o status do contato." }
        }

        revalidatePath("/contacts")
        revalidatePath("/contacts/site")
        revalidatePath(`/contacts/${parsed.data.contactId}`)

        return { success: true, data: { status: parsed.data.status } }
    } catch (error) {
        console.error("Unexpected error updating contact status:", error)
        return { success: false, error: "Erro ao atualizar o status do contato." }
    }
}

export async function deleteContact(contactId: string): Promise<ActionResult<{ deletedId: string }>> {
    try {
        const parsed = deleteContactSchema.safeParse({ contactId })
        if (!parsed.success) {
            return { success: false, error: "Contato inválido para exclusão." }
        }

        const context = await getContactActionContext()
        if ("error" in context) {
            return { success: false, error: context.error ?? "Sem permissão." }
        }

        const { supabase, profile } = context

        if (!isAdmin(profile.role)) {
            return { success: false, error: "Você não tem permissão para excluir contatos." }
        }

        const { data: contact } = await supabase
            .from("contacts")
            .select("id, organization_id")
            .eq("id", parsed.data.contactId)
            .single()

        if (!contact || contact.organization_id !== profile.organization_id) {
            return { success: false, error: "Contato não encontrado ou sem acesso." }
        }

        const [proposalsResult, contractsResult, appointmentsResult] = await Promise.all([
            supabase
                .from("deal_proposals")
                .select("id", { count: "exact", head: true })
                .eq("contact_id", parsed.data.contactId)
                .eq("organization_id", profile.organization_id),
            supabase
                .from("deal_contracts")
                .select("id", { count: "exact", head: true })
                .eq("contact_id", parsed.data.contactId)
                .eq("organization_id", profile.organization_id),
            supabase
                .from("appointments")
                .select("id", { count: "exact", head: true })
                .eq("contact_id", parsed.data.contactId)
                .eq("organization_id", profile.organization_id),
        ])

        const dependencyChecks = [
            { singular: "proposta", plural: "propostas", count: proposalsResult.count ?? 0 },
            { singular: "contrato", plural: "contratos", count: contractsResult.count ?? 0 },
            { singular: "visita", plural: "visitas", count: appointmentsResult.count ?? 0 },
        ]

        if (dependencyChecks.some((dependency) => dependency.count > 0)) {
            const summary = dependencyChecks
                .filter((dependency) => dependency.count > 0)
                .map(
                    (dependency) =>
                        `${dependency.count} ${dependency.count === 1 ? dependency.singular : dependency.plural}`
                )
                .join(", ")

            return {
                success: false,
                error: `Este contato possui ${summary} vinculados. Remova esses vínculos antes de excluir.`,
            }
        }

        const { error } = await supabase
            .from("contacts")
            .delete()
            .eq("id", parsed.data.contactId)
            .eq("organization_id", profile.organization_id)

        if (error) {
            console.error("Error deleting contact:", error)
            return { success: false, error: "Não foi possível excluir o contato." }
        }

        revalidatePath("/contacts")
        revalidatePath("/contacts/site")
        revalidatePath(`/contacts/${parsed.data.contactId}`)

        return { success: true, data: { deletedId: parsed.data.contactId } }
    } catch (error) {
        console.error("Unexpected error deleting contact:", error)
        return { success: false, error: "Não foi possível excluir o contato." }
    }
}

export async function saveContactInterestProfile(input: {
    contact_id: string
    profile: InterestProfile
}): Promise<ActionResult<{ id: string }>> {
    try {
        const parsed = saveInterestProfileInputSchema.safeParse(input)
        if (!parsed.success) {
            return {
                success: false,
                error: parsed.error.issues[0]?.message ?? "Perfil de interesse inválido.",
            }
        }

        const profileInput = parsed.data.profile
        if (
            typeof profileInput.price_min === "number" &&
            typeof profileInput.price_max === "number" &&
            profileInput.price_min > profileInput.price_max
        ) {
            return {
                success: false,
                error: "Valor mínimo não pode ser maior que o máximo.",
            }
        }

        const context = await getContactActionContext()
        if ("error" in context) {
            return { success: false, error: context.error ?? "Sem permissão." }
        }

        const { supabase } = context
        const { data: orgIdResult, error: orgIdError } = await supabase.rpc("current_user_org_id")

        if (orgIdError || !orgIdResult) {
            return { success: false, error: "Sem permissão." }
        }

        const sanitizedProfile = Object.fromEntries(
            Object.entries(profileInput).filter(([, value]) => value !== undefined)
        )

        const { data, error } = await supabase
            .from("contacts")
            .update({
                interest_profile: sanitizedProfile,
                updated_at: new Date().toISOString(),
            })
            .eq("id", parsed.data.contact_id)
            .eq("organization_id", orgIdResult)
            .select("id")
            .single()

        if (error) {
            console.error("Error saving contact interest profile:", error)
            return {
                success: false,
                error: error.message || "Erro ao salvar perfil de interesse.",
            }
        }

        if (!data?.id) {
            return { success: false, error: "Contato não encontrado ou sem acesso." }
        }

        revalidatePath(`/contacts/${parsed.data.contact_id}`)
        revalidatePath("/contacts")
        return { success: true, data: { id: data.id } }
    } catch (error) {
        console.error("Unexpected error saving contact interest profile:", error)
        return {
            success: false,
            error: error instanceof Error ? error.message : "Erro ao salvar perfil de interesse.",
        }
    }
}
