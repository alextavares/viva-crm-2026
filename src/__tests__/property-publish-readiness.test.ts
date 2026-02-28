import { getPropertyPublishIssues, isPropertyPublishReady } from "@/lib/property-publish-readiness"

describe("property publish readiness", () => {
  it("marks missing price and type as blocking issues", () => {
    const issues = getPropertyPublishIssues({
      address: { city: "Sao Paulo" },
      images: ["https://example.com/1.jpg"],
      description: "Descricao suficientemente longa para nao cair no aviso de qualidade basico do primeiro corte.",
      price: 0,
      type: null,
    })

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "missing_price", severity: "blocking" }),
        expect.objectContaining({ key: "missing_type", severity: "blocking" }),
      ])
    )
    expect(isPropertyPublishReady({
      address: { city: "Sao Paulo" },
      images: ["https://example.com/1.jpg"],
      description: "Descricao suficientemente longa para nao cair no aviso de qualidade basico do primeiro corte.",
      price: 0,
      type: null,
    })).toBe(false)
  })

  it("marks short description as warning only", () => {
    const property = {
      address: { city: "Campinas" },
      images: ["https://example.com/1.jpg"],
      description: "Descricao curta",
      price: 500000,
      type: "house",
    }

    const issues = getPropertyPublishIssues(property)

    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "short_description", severity: "warning" })])
    )
    expect(issues.some((issue) => issue.severity === "blocking")).toBe(false)
    expect(isPropertyPublishReady(property)).toBe(true)
  })

  it("returns ready when only warnings are present", () => {
    const property = {
      address: { city: "Rio de Janeiro" },
      images: ["https://example.com/1.jpg"],
      description: "",
      price: 750000,
      type: "apartment",
    }

    expect(isPropertyPublishReady(property)).toBe(true)
  })
})
