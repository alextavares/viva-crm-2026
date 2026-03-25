import { getImovelwebReadinessIssues } from "@/lib/integrations/imovelweb-readiness"

describe("imovelweb readiness", () => {
  it("reports integration and property blockers required by OpenNavent", () => {
    const issues = getImovelwebReadinessIssues(
      [
        {
          id: "property-1",
          title: "Apartamento sem localidade",
          description: "Descricao curta",
          price: 0,
          type: "warehouse",
          status: "available",
          images: [],
          image_paths: [],
          address: {
            city: "Campinas",
            state: "SP",
            street: "Rua Central",
          },
          hide_from_site: false,
        },
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
        {
          id: "property-1",
          title: "Apartamento pronto",
          description: "Descricao completa o bastante para nao disparar alerta de descricao curta no portal oficial.",
          price: 500000,
          type: "apartment",
          status: "available",
          images: ["https://example.com/1.jpg"],
          image_paths: [],
          address: {
            city: "Campinas",
            state: "SP",
            street: "Rua Central",
          },
          hide_from_site: false,
        },
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
        {
          id: "property-1",
          title: "Apartamento mapeado",
          description: "Descricao completa o bastante para nao disparar alerta de descricao curta no portal oficial.",
          price: 500000,
          type: "apartment",
          status: "available",
          images: ["https://example.com/1.jpg"],
          image_paths: [],
          address: {
            city: "Campinas",
            state: "SP",
            street: "Rua Central",
          },
          hide_from_site: false,
        },
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
        {
          id: "property-1",
          title: "Casa em Maresias",
          description: "Descricao completa o bastante para nao disparar alerta de descricao curta no portal oficial.",
          price: 950000,
          type: "house",
          status: "available",
          images: ["https://example.com/1.jpg"],
          image_paths: [],
          address: {
            city: "São Sebastião",
            state: "SP",
            neighborhood: "Maresias",
            street: "Rua da Praia",
          },
          hide_from_site: false,
        },
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
        {
          id: "property-1",
          title: "Apartamento com localidade",
          description: "Descricao completa o bastante para nao disparar alerta de descricao curta no portal oficial.",
          price: 500000,
          type: "apartment",
          status: "available",
          images: ["https://example.com/1.jpg"],
          image_paths: [],
          address: {
            city: "Campinas",
            state: "SP",
            street: "Rua Central",
            localidade: "Campinas",
          },
          hide_from_site: false,
        },
      ],
      {
        codigo_imobiliaria: "47362968",
      }
    )

    expect(issues.some((issue) => issue.issueKey === "missing_localidade")).toBe(false)
    expect(issues.some((issue) => issue.issueKey === "using_localidade_name")).toBe(true)
  })
})
