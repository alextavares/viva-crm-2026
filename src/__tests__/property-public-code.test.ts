import { generatePropertyPublicCode } from "@/lib/properties/public-code"

describe("generatePropertyPublicCode", () => {
    it("matches the V-XXXXXXXX reference format", () => {
        expect(generatePropertyPublicCode()).toMatch(/^V-[0-9A-F]{8}$/)
    })

    it("generates unique codes within the 80-char canonical limit", () => {
        const codes = new Set(Array.from({ length: 200 }, () => generatePropertyPublicCode()))
        expect(codes.size).toBe(200)
        for (const code of codes) {
            expect(code.length).toBeLessThanOrEqual(80)
            expect(code.trim().length).toBeGreaterThan(0)
        }
    })
})
