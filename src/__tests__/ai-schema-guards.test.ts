import { isMissingAiSchemaErrorMessage } from "@/lib/ai-leads/schema-guards"

describe("isMissingAiSchemaErrorMessage", () => {
  it("detects missing ai schema cache errors", () => {
    expect(
      isMissingAiSchemaErrorMessage(
        `PGRST205 Could not find the table 'public.ai_lead_sessions' in the schema cache`
      )
    ).toBe(true)
  })

  it("ignores unrelated errors", () => {
    expect(isMissingAiSchemaErrorMessage("PGRST116 The result contains 0 rows")).toBe(false)
  })
})
