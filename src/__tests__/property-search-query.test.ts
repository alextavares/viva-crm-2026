import { buildPropertySearchOrTerms } from "@/lib/property-search-query"

describe("buildPropertySearchOrTerms", () => {
  it("searches public code, external id, title, and owner for a code with prefix", () => {
    expect(buildPropertySearchOrTerms("V-598")).toEqual([
      "title.ilike.%V-598%",
      "public_code.ilike.%V-598%",
      "external_id.ilike.%V-598%",
      "owner_name.ilike.%V-598%",
      "public_code.ilike.%598%",
      "external_id.ilike.%598%",
    ])
  })

  it("keeps numeric code search useful", () => {
    expect(buildPropertySearchOrTerms("598")).toContain("public_code.ilike.%598%")
  })

  it("supports exact UUID search", () => {
    const uuid = "f496e2f0-4f44-4c6d-a26c-52dab360f24d"
    expect(buildPropertySearchOrTerms(uuid)).toContain(`id.eq.${uuid}`)
  })

  it("removes Supabase OR control characters from text search", () => {
    expect(buildPropertySearchOrTerms("V-598,%()")).toContain("public_code.ilike.%V-598%")
  })
})
