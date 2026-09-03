import { getImovelwebReadinessIssues } from "@/lib/integrations/imovelweb-readiness"

function buildProperty(
  overrides: Partial<Parameters<typeof getImovelwebReadinessIssues>[0][number]> = {}
) {
  return {
    id: "property-1",
    title: "Imóvel teste",
    description:
      "Descrição completa para validar publicação no Imovelweb com os campos mínimos exigidos pelo portal.",
    price: 850000,
    type: "house",
    status: "available",
    images: ["https://example.com/property-1.jpg"],
    image_paths: [],
    address: {
      street: "Rua Central",
      city: "São Sebastião",
      state: "SP",
      zip: "11600-000",
      neighborhood: "Centro",
      lat: -23.8,
      lng: -45.4,
    },
    hide_from_site: false,
    ...overrides,
  }
}

describe("imovelweb readiness", () => {
  it("reports integration and property blockers required by OpenNavent", () => {
    const issues = getImovelwebReadinessIssues(
      [
        buildProperty({
          title: "Apartamento sem localidade",
          description: "Descricao curta",
          price: 0,
          type: "warehouse",
          images: [],
          address: {
            city: "Campinas",
            state: "SP",
            street: "Rua Central",
          },
        }),
      ],
      {},
      {
        sendOnlyAvailable: true,
        sendOnlyWithPhotos: true,
      }
    )

    expect(issues.some((issue) => issue.issueKey === "missing_codigo_imobiliaria")).toBe(true)
    expect(issues.some((issue) => issue.issueKey === "missing_photos")).toBe(true)
    expect(issues.some((issue) => issue.issueKey === "missing_price")).toBe(true)
    expect(issues.some((issue) => issue.issueKey === "unsupported_type")).toBe(true)
    expect(issues.some((issue) => issue.issueKey === "missing_localidade")).toBe(true)
  })

  it("uses default localidade id from integration config", () => {
    const issues = getImovelwebReadinessIssues(
      [
        buildProperty({
          title: "Apartamento pronto",
          type: "apartment",
          address: {
            city: "Campinas",
            state: "SP",
            street: "Rua Central",
          },
        }),
      ],
      {
        codigo_imobiliaria: "47362968",
        default_localidade_id: "V1-D-513972",
      }
    )

    expect(issues.some((issue) => issue.issueKey === "missing_localidade")).toBe(false)
    expect(issues.some((issue) => issue.issueKey === "missing_codigo_imobiliaria")).toBe(false)
  })

  it("resolves localidade through city/uf mappings and flags invalid lines", () => {
    const issues = getImovelwebReadinessIssues(
      [
        buildProperty({
          title: "Apartamento mapeado",
          type: "apartment",
          address: {
            city: "Campinas",
            state: "SP",
            street: "Rua Central",
          },
        }),
      ],
      {
        codigo_imobiliaria: "47362968",
        localidade_mappings_raw: "SP|Campinas=V1-D-513972\nlinha-invalida",
      }
    )

    expect(issues.some((issue) => issue.issueKey === "missing_localidade")).toBe(false)
    expect(issues.some((issue) => issue.issueKey === "invalid_localidade_mapping_lines")).toBe(true)
  })

  it("prefers neighborhood mappings over city-level mappings", () => {
    const issues = getImovelwebReadinessIssues(
      [
        buildProperty({
          title: "Casa em Maresias",
          type: "house",
          address: {
            city: "São Sebastião",
            state: "SP",
            neighborhood: "Maresias",
            street: "Rua da Praia",
          },
        }),
      ],
      {
        codigo_imobiliaria: "47362968",
        localidade_mappings_raw: "SP|São Sebastião=V1-C-109673\nSP|São Sebastião|Maresias=V1-D-499784",
      }
    )

    expect(issues.some((issue) => issue.issueKey === "missing_localidade")).toBe(false)
    expect(issues.some((issue) => issue.issueKey === "using_default_localidade")).toBe(false)
    expect(issues.some((issue) => issue.issueKey === "using_localidade_name")).toBe(false)
  })

  it("accepts explicit localidade name when idLocalidade is unavailable", () => {
    const issues = getImovelwebReadinessIssues(
      [
        buildProperty({
          title: "Apartamento com localidade",
          type: "apartment",
          address: {
            city: "Campinas",
            state: "SP",
            street: "Rua Central",
            localidade: "Campinas",
          },
        }),
      ],
      {
        codigo_imobiliaria: "47362968",
      }
    )

    expect(issues.some((issue) => issue.issueKey === "missing_localidade")).toBe(false)
    expect(issues.some((issue) => issue.issueKey === "using_localidade_name")).toBe(true)
  })

  it("accepts condominium houses as supported type", () => {
    const issues = getImovelwebReadinessIssues(
      [buildProperty({ type: "condominium_house", title: "Casa em condomínio em Juquehy" })],
      {
        codigo_imobiliaria: "47362968",
        default_localidade_id: "V1-D-499784",
      }
    )

    expect(issues.map((issue) => issue.issueKey)).not.toContain("unsupported_type")
  })

  it("accepts commercial spaces as supported type", () => {
    const issues = getImovelwebReadinessIssues(
      [buildProperty({ type: "commercial_space", title: "Espaço comercial no centro" })],
      {
        codigo_imobiliaria: "47362968",
        default_localidade_id: "V1-D-499784",
      }
    )

    expect(issues.map((issue) => issue.issueKey)).not.toContain("unsupported_type")
  })
})
