import { brokerPublicProfileSchema, resolvePublicBrokerDisplayName } from "@/lib/team/public-profile"

describe("team public profile helpers", () => {
  it("normalizes optional empty strings to null", () => {
    const parsed = brokerPublicProfileSchema.parse({
      profileId: "11111111-1111-4111-8111-111111111111",
      public_profile_enabled: false,
      public_display_name: "   ",
      creci: "",
      public_whatsapp: "",
      avatar_url: "",
    })

    expect(parsed.public_display_name).toBeNull()
    expect(parsed.creci).toBeNull()
    expect(parsed.public_whatsapp).toBeNull()
    expect(parsed.avatar_url).toBeNull()
  })

  it("rejects invalid public whatsapp values", () => {
    const parsed = brokerPublicProfileSchema.safeParse({
      profileId: "11111111-1111-4111-8111-111111111111",
      public_profile_enabled: true,
      public_display_name: "Corretor Público",
      creci: null,
      public_whatsapp: "12345",
      avatar_url: null,
    })

    expect(parsed.success).toBe(false)
  })

  it("prefers public display name and falls back to full name", () => {
    expect(resolvePublicBrokerDisplayName("  Marina Pública  ", "Marina Costa")).toBe("Marina Pública")
    expect(resolvePublicBrokerDisplayName(null, " Marina Costa ")).toBe("Marina Costa")
    expect(resolvePublicBrokerDisplayName(" ", " ")).toBeNull()
  })
})
