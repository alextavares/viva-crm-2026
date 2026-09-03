import { createClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/lib/types"

type AppSupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ContactFollowupActionType = "pause" | "resume" | "cancel"

export type FollowupProcessSummary = {
    processed: number
    sent: number
    failed: number
    blocked: number
    official_sent: number
}

export type LeadRedistributionSummary = {
    checked: number
    reassigned: number
}

function toSafeNumber(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function normalizeFollowupProcessSummary(data: unknown): FollowupProcessSummary {
    const summary = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>

    return {
        processed: toSafeNumber(summary.processed),
        sent: toSafeNumber(summary.sent),
        failed: toSafeNumber(summary.failed),
        blocked: toSafeNumber(summary.blocked),
        official_sent: toSafeNumber(summary.official_sent),
    }
}

function normalizeLeadRedistributionSummary(data: unknown): LeadRedistributionSummary {
    const summary = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>

    return {
        checked: toSafeNumber(summary.checked),
        reassigned: toSafeNumber(summary.reassigned),
    }
}

export async function processFollowupsForOrganization(
    supabase: AppSupabaseClient,
    organizationId: string | null,
    limit: number
): Promise<ActionResult<FollowupProcessSummary>> {
    const { data, error } = await supabase.rpc("followup_process_due", {
        p_limit: limit,
        p_org_id: organizationId,
    })

    if (error) {
        return { success: false, error: error.message || "Falha ao processar follow-ups." }
    }

    return { success: true, data: normalizeFollowupProcessSummary(data) }
}

export async function redistributeOverdueLeadsForOrganization(
    supabase: AppSupabaseClient,
    organizationId: string | null,
    limit: number
): Promise<ActionResult<LeadRedistributionSummary>> {
    const { data, error } = await supabase.rpc("lead_redistribute_overdue", {
        p_limit: limit,
        p_org_id: organizationId,
    })

    if (error) {
        return { success: false, error: error.message || "Falha ao redistribuir leads atrasados." }
    }

    return { success: true, data: normalizeLeadRedistributionSummary(data) }
}

export async function applyContactFollowupActionForOrganization(
    supabase: AppSupabaseClient,
    organizationId: string,
    contactId: string,
    action: ContactFollowupActionType
): Promise<ActionResult<{ action: ContactFollowupActionType; affected: number }>> {
    const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("id", contactId)
        .eq("organization_id", organizationId)
        .maybeSingle()

    if (!contact) {
        return { success: false, error: "Contato não encontrado para atualizar a régua." }
    }

    if (action === "pause") {
        const { data, error } = await supabase
            .from("followup_jobs")
            .update({ status: "paused", updated_at: new Date().toISOString() })
            .eq("organization_id", organizationId)
            .eq("contact_id", contactId)
            .eq("status", "pending")
            .select("id")

        if (error) {
            return { success: false, error: error.message || "Falha ao pausar a régua." }
        }

        return { success: true, data: { action, affected: data?.length ?? 0 } }
    }

    if (action === "cancel") {
        const { data, error } = await supabase
            .from("followup_jobs")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("organization_id", organizationId)
            .eq("contact_id", contactId)
            .in("status", ["pending", "paused"])
            .select("id")

        if (error) {
            return { success: false, error: error.message || "Falha ao cancelar a régua." }
        }

        return { success: true, data: { action, affected: data?.length ?? 0 } }
    }

    const { data: pausedJobs, error: pausedError } = await supabase
        .from("followup_jobs")
        .select("id, scheduled_at")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .eq("status", "paused")
        .order("scheduled_at", { ascending: true })

    if (pausedError) {
        return { success: false, error: pausedError.message || "Falha ao carregar follow-ups pausados." }
    }

    const now = Date.now()
    let affected = 0

    for (const job of pausedJobs || []) {
        const scheduledAt = new Date(job.scheduled_at).getTime()
        const nextScheduledAt = new Date(Math.max(scheduledAt, now + 10_000)).toISOString()

        const { error } = await supabase
            .from("followup_jobs")
            .update({
                status: "pending",
                scheduled_at: nextScheduledAt,
                updated_at: new Date().toISOString(),
                error: null,
            })
            .eq("id", job.id)
            .eq("organization_id", organizationId)

        if (error) {
            return { success: false, error: error.message || "Falha ao retomar a régua." }
        }

        affected += 1
    }

    return { success: true, data: { action, affected } }
}
