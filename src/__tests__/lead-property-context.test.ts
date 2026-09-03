import {
  buildLeadPropertyContext,
  extractLeadPropertyReference,
  type PropertyLookupRecord,
} from "@/lib/contacts/lead-property-context"

describe("lead property context", () => {
  it("extracts property reference from nested metadata payload", () => {
    const reference = extractLeadPropertyReference({
      metadata: {
        property_id: "property-1",
      },
    })

    expect(reference).toEqual({
      id: "property-1",
      title: null,
    })
  })

  it("builds a clear property label from lookup when payload has no title", () => {
    const lookup = new Map<string, PropertyLookupRecord>([
      [
        "property-1",
        {
          id: "property-1",
          title: "Apartamento Vista Mar",
          public_code: "V-101",
        },
      ],
    ])

    const context = buildLeadPropertyContext(
      {
        id: "property-1",
        title: null,
      },
      lookup
    )

    expect(context).toEqual({
      id: "property-1",
      title: "[V-101] Apartamento Vista Mar",
    })
  })
})
