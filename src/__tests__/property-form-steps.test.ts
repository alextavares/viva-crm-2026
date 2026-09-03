import {
  PROPERTY_FORM_STEPS,
  countPropertyIssuesByStep,
  getNextPortalPublicationValues,
  getPropertyFormStepForField,
} from "@/lib/properties/property-form-steps"

describe("property form steps", () => {
  it("keeps the operational steps in the expected order", () => {
    expect(PROPERTY_FORM_STEPS.map((step) => step.id)).toEqual([
      "essentials",
      "owner",
      "commercial",
      "location",
      "media",
      "publication",
    ])
  })

  it("maps readiness focus fields to the correct step", () => {
    expect(getPropertyFormStepForField("property-title")).toBe("essentials")
    expect(getPropertyFormStepForField("property-owner")).toBe("owner")
    expect(getPropertyFormStepForField("property-description")).toBe("commercial")
    expect(getPropertyFormStepForField("address_city")).toBe("location")
    expect(getPropertyFormStepForField("property-images")).toBe("media")
    expect(getPropertyFormStepForField("property-site-visibility")).toBe("publication")
  })

  it("counts critical and light issues by step", () => {
    const counts = countPropertyIssuesByStep([
      { code: "missing_price", label: "Preço", severity: "critical", group: "essentials", focusFieldId: "property-price" },
      { code: "missing_city", label: "Cidade", severity: "critical", group: "location", focusFieldId: "address_city" },
      { code: "few_images", label: "Fotos", severity: "light", group: "media", focusFieldId: "property-images" },
      { code: "missing_owner", label: "Proprietário", severity: "light", group: "owner", focusFieldId: "property-owner" },
    ])

    expect(counts.essentials).toBe(1)
    expect(counts.location).toBe(1)
    expect(counts.media).toBe(1)
    expect(counts.owner).toBe(1)
    expect(counts.publication).toBe(0)
  })

  it("enables default portal channels when portal publishing is turned on", () => {
    expect(getNextPortalPublicationValues(true)).toEqual({
      publish_to_portals: true,
      publish_imovelweb: true,
      publish_zap: true,
      publish_olx: true,
    })
  })

  it("clears all portal channels when portal publishing is turned off", () => {
    expect(getNextPortalPublicationValues(false)).toEqual({
      publish_to_portals: false,
      publish_imovelweb: false,
      publish_zap: false,
      publish_olx: false,
    })
  })
})
