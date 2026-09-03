import { buildOpportunityStagePayload } from "@/lib/opportunities/stage"
import {
    formatManualFollowupSource,
    parseManualFollowupDescription,
} from "@/lib/followups/manual-followup"

describe("buildOpportunityStagePayload", () => {
    it("advances an open opportunity without closing", () => {
        const result = buildOpportunityStagePayload("new", "visit")
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.patch.stage).toBe("visit")
            expect(result.patch.closed_at).toBeNull()
            expect(result.patch.loss_reason).toBeNull()
        }
    })

    it("closes on won with timestamp", () => {
        const result = buildOpportunityStagePayload("proposal", "won")
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.patch.closed_at).not.toBeNull()
        }
    })

    it("requires a loss reason for lost", () => {
        expect(buildOpportunityStagePayload("negotiation", "lost").ok).toBe(false)
        const result = buildOpportunityStagePayload("negotiation", "lost", "Preço acima do orçamento")
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.patch.loss_reason).toBe("Preço acima do orçamento")
            expect(result.patch.closed_at).not.toBeNull()
        }
    })

    it("blocks transitions out of terminal stages", () => {
        expect(buildOpportunityStagePayload("won", "negotiation").ok).toBe(false)
        expect(buildOpportunityStagePayload("lost", "new").ok).toBe(false)
    })
})

describe("manual followup source", () => {
    it("round-trips the description through source", () => {
        const source = formatManualFollowupSource("Ligar para confirmar a visita")
        expect(parseManualFollowupDescription(source)).toBe("Ligar para confirmar a visita")
    })

    it("rejects non-manual sources", () => {
        expect(parseManualFollowupDescription("sequence-5m")).toBeNull()
        expect(parseManualFollowupDescription(null)).toBeNull()
    })
})
