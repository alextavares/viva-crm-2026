import type { OpportunityStage } from "@/lib/types"

export function buildOpportunityStagePayload(
    currentStage: string | null,
    nextStage: OpportunityStage,
    lossReason?: string | null
): { ok: true; patch: Record<string, string | null> } | { ok: false; error: string } {
    if (currentStage === "won" || currentStage === "lost") {
        return { ok: false, error: "Oportunidade encerrada não pode mudar de estágio." }
    }
    if (nextStage === "lost" && !lossReason?.trim()) {
        return { ok: false, error: "Informe o motivo da perda para concluir como perdida." }
    }
    const closed = nextStage === "won" || nextStage === "lost"
    return {
        ok: true,
        patch: {
            stage: nextStage,
            loss_reason: nextStage === "lost" ? (lossReason?.trim() ?? null) : null,
            closed_at: closed ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
        },
    }
}
