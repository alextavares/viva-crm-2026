import {
  getPropertyOperationalSnapshot,
  getPropertyOperationalStatusLabel,
  normalizeProperty,
} from "@/lib/property-operational-readiness"

describe("property operational readiness", () => {
  it("normalizes the property payload into operational flags", () => {
    const normalized = normalizeProperty({
      id: "property-1",
      public_code: "V-100",
      title: "Casa em Maresias",
      type: "house",
      transaction_type: "sale",
      price: 950000,
    assigned_to: "broker-1",
      description:
        "Casa ampla em condomínio com piscina, espaço gourmet e ótima localização perto da praia.",
      address: {
        city: "São Sebastião",
        neighborhood: "Maresias",
        full_address: "Rua Exemplo, 10 - Maresias - São Sebastião - SP",
      },
      features: {
        bedrooms: 4,
        bathrooms: 3,
        area: 180,
      },
      images: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      status: "available",
      hide_from_site: false,
    })

    expect(normalized.code).toBe("V-100")
    expect(normalized.hasMinimalLocation).toBe(true)
    expect(normalized.hasResponsible).toBe(true)
    expect(normalized.isPublished).toBe(true)
    expect(normalized.imageCount).toBe(2)
  })

  it("marks an incomplete property as draft with critical issues", () => {
    const snapshot = getPropertyOperationalSnapshot({
      id: "property-2",
      title: "Imóvel incompleto",
      price: 0,
      type: null,
      transaction_type: null,
    assigned_to: null,
      description: "",
      address: { city: "", neighborhood: "" },
      images: [],
      status: "available",
      hide_from_site: true,
    })

    expect(snapshot.status).toBe("draft")
    expect(snapshot.criticalIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing_type",
        "missing_transaction_type",
        "missing_price",
        "missing_city",
        "missing_neighborhood",
        "missing_responsible",
        "missing_description",
        "missing_images",
      ])
    )
    expect(snapshot.reasonSummary.toLowerCase()).toContain("faltam")
  })

  it("marks a minimally complete unpublished property as publishable", () => {
    const snapshot = getPropertyOperationalSnapshot({
      id: "property-3",
      title: "Apartamento no centro",
      price: 540000,
      type: "apartment",
      transaction_type: "sale",
    assigned_to: "broker-1",
      description:
        "Apartamento bem localizado, com ambientes integrados, excelente iluminação natural e documentação em dia.",
      address: { city: "São Paulo", neighborhood: "Centro" },
      features: { bedrooms: 2, bathrooms: 1, area: 68 },
      images: ["https://example.com/1.jpg"],
      status: "available",
      hide_from_site: true,
    })

    expect(snapshot.status).toBe("publishable")
    expect(snapshot.criticalIssues).toHaveLength(0)
    expect(snapshot.lightIssues.map((issue) => issue.code)).toContain("few_images")
  })

  it("marks a published property with light issues as low quality", () => {
    const snapshot = getPropertyOperationalSnapshot({
      id: "property-4",
      title: "Casa em condomínio",
      price: 1200000,
      type: "house",
      transaction_type: "sale",
    assigned_to: "broker-1",
      description: "Casa linda com acabamento premium.",
      address: { city: "São Sebastião", neighborhood: "Camburi" },
      features: { bedrooms: 4, bathrooms: 2, area: 140 },
      images: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      status: "available",
      hide_from_site: false,
    })

    expect(snapshot.status).toBe("published_low_quality")
    expect(snapshot.lightIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["few_images", "weak_description"])
    )
  })

  it("flags a short title as a commercial improvement issue", () => {
    const snapshot = getPropertyOperationalSnapshot({
      id: "property-4b",
      title: "Casa boa",
      price: 980000,
      type: "house",
      transaction_type: "sale",
    assigned_to: "broker-1",
      description:
        "Casa charmosa com piscina, varanda gourmet, iluminação natural, boa planta e localização valorizada perto da praia.",
      address: { city: "São Sebastião", neighborhood: "Camburi" },
      features: { bedrooms: 3, bathrooms: 2, area: 150 },
      images: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
        "https://example.com/5.jpg",
      ],
      status: "available",
      hide_from_site: false,
    })

    expect(snapshot.lightIssues.map((issue) => issue.code)).toContain("weak_title")
    expect(snapshot.status).toBe("published_low_quality")
  })

  it("marks a published property with strong data as high quality", () => {
    const snapshot = getPropertyOperationalSnapshot({
      id: "property-5",
      title: "Casa alto padrão em Juquehy",
      price: 2500000,
      type: "house",
      transaction_type: "sale",
    assigned_to: "broker-1",
      description:
        "Casa alto padrão com cinco suítes, espaço gourmet completo, piscina aquecida, paisagismo, vista aberta e excelente integração entre os ambientes sociais e a área externa.",
      address: { city: "São Sebastião", neighborhood: "Juquehy" },
      features: { bedrooms: 5, bathrooms: 6, area: 420 },
      images: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
        "https://example.com/5.jpg",
      ],
      status: "available",
      hide_from_site: false,
    })

    expect(snapshot.status).toBe("published_high_quality")
    expect(snapshot.criticalIssues).toHaveLength(0)
    expect(snapshot.lightIssues).toHaveLength(0)
    expect(getPropertyOperationalStatusLabel(snapshot.status)).toBe("Publicado com alta qualidade")
  })

  it("treats condominium houses as residential for readiness checks", () => {
    const snapshot = getPropertyOperationalSnapshot({
      id: "property-6",
      title: "Casa em condomínio em Juquehy",
      price: 2100000,
      type: "condominium_house",
      transaction_type: "sale",
    assigned_to: "broker-1",
      description:
        "Casa em condomínio com lazer completo, boa iluminação e potencial para anúncio premium.",
      address: { city: "São Sebastião", neighborhood: "Juquehy" },
      features: { bedrooms: 0, bathrooms: 0, area: 180 },
      images: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
      status: "available",
      hide_from_site: true,
    })

    expect(snapshot.lightIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing_bedrooms", "missing_bathrooms"])
    )
  })

  it("does not require bedrooms or bathrooms for commercial spaces", () => {
    const snapshot = getPropertyOperationalSnapshot({
      id: "property-7",
      title: "Espaço comercial no centro",
      price: 780000,
      type: "commercial_space",
      transaction_type: "sale",
    assigned_to: "broker-1",
      description:
        "Espaço comercial com fachada visível, planta flexível, boa circulação e endereço estratégico para operação.",
      address: { city: "São Paulo", neighborhood: "Centro" },
      features: { bedrooms: 0, bathrooms: 0, area: 95 },
      images: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
        "https://example.com/5.jpg",
      ],
      status: "available",
      hide_from_site: true,
    })

    expect(snapshot.status).toBe("publishable")
    expect(snapshot.lightIssues.map((issue) => issue.code)).not.toEqual(
      expect.arrayContaining(["missing_bedrooms", "missing_bathrooms"])
    )
  })
})
