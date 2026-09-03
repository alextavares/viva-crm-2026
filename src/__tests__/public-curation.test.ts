import {
  filterCuratedPublicProperties,
  getPublicCurationSnapshot,
  getPublicSiteReleaseReadiness,
  isPresentablePublicTitle,
} from "@/lib/public-site/public-curation"

describe("public curation", () => {
  it("blocks properties that still look weak for the public showcase", () => {
    const snapshot = getPublicCurationSnapshot({
      id: "property-1",
      title: "testse",
      price: null,
      description: "curta demais",
      images: [],
      hide_from_site: false,
    })

    expect(snapshot.readyForVitrine).toBe(false)
    expect(snapshot.visibleOnPublicSite).toBe(false)
    expect(snapshot.blockingReasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(["weak_title", "missing_price", "missing_images"])
    )
    expect(snapshot.reasonSummary.toLowerCase()).toContain("pendências de publicação")
  })

  it("marks a curated hidden property as ready to publish", () => {
    const snapshot = getPublicCurationSnapshot({
      id: "property-2",
      title: "Casa alto padrão em Juquehy com piscina e 4 suítes",
      price: 3200000,
      description:
        "Casa com quatro suítes, piscina, espaço gourmet completo e apresentação pronta para anunciar no site público.",
      images: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
        "https://example.com/5.jpg",
      ],
      hide_from_site: true,
    })

    expect(snapshot.readyForVitrine).toBe(true)
    expect(snapshot.canPublishNow).toBe(true)
    expect(snapshot.visibleOnPublicSite).toBe(false)
    expect(snapshot.reasonSummary).toContain("oculto no site")
  })

  it("treats only available curated hidden properties as ready to release on the public site", () => {
    const property = {
      id: "property-available-hidden",
      title: "Casa alto padrão em Juquehy com piscina e 4 suítes",
      price: 3200000,
      description:
        "Casa com quatro suítes, piscina, espaço gourmet completo e apresentação pronta para anunciar no site público.",
      images: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
        "https://example.com/5.jpg",
      ],
      hide_from_site: true,
      status: "available",
    }

    const readiness = getPublicSiteReleaseReadiness(property)

    expect(readiness).toEqual({
      commerciallyAvailable: true,
      readyToRelease: true,
      blockedByCuration: false,
      liveOnPublicSite: false,
    })
  })

  it("does not treat commercially unavailable properties as ready to release", () => {
    const property = {
      id: "property-sold-hidden",
      title: "Casa alto padrão em Juquehy com piscina e 4 suítes",
      price: 3200000,
      description:
        "Casa com quatro suítes, piscina, espaço gourmet completo e apresentação pronta para anunciar no site público.",
      images: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
        "https://example.com/5.jpg",
      ],
      hide_from_site: true,
      status: "sold",
    }

    const readiness = getPublicSiteReleaseReadiness(property)

    expect(readiness).toEqual({
      commerciallyAvailable: false,
      readyToRelease: false,
      blockedByCuration: false,
      liveOnPublicSite: false,
    })
  })

  it("keeps commercially available properties with critical showcase blockers in the blocked bucket", () => {
    const property = {
      id: "property-blocked",
      title: "Casa boa",
      price: null,
      description: "curta demais",
      images: [],
      hide_from_site: true,
      status: "available",
    }

    const readiness = getPublicSiteReleaseReadiness(property)

    expect(readiness).toEqual({
      commerciallyAvailable: true,
      readyToRelease: false,
      blockedByCuration: true,
      liveOnPublicSite: false,
    })
  })

  it("marks available curated visible properties as live on the public site", () => {
    const property = {
      id: "property-live",
      title: "Casa alto padrão em Juquehy com piscina e 4 suítes",
      price: 3200000,
      description:
        "Casa com quatro suítes, piscina, espaço gourmet completo e apresentação pronta para anunciar no site público.",
      images: [
        "https://example.com/1.jpg",
        "https://example.com/2.jpg",
        "https://example.com/3.jpg",
        "https://example.com/4.jpg",
        "https://example.com/5.jpg",
      ],
      hide_from_site: false,
      status: "available",
    }

    const readiness = getPublicSiteReleaseReadiness(property)

    expect(readiness).toEqual({
      commerciallyAvailable: true,
      readyToRelease: false,
      blockedByCuration: false,
      liveOnPublicSite: true,
    })
  })

  it("keeps only curated properties in the public listing", () => {
    const curated = filterCuratedPublicProperties([
      {
        id: "property-ok",
        public_code: "V-100",
        title: "Casa com piscina em Maresias e 3 dormitórios",
        price: 1850000,
        type: "house",
        city: "São Sebastião",
        state: "SP",
        neighborhood: "Maresias",
        thumbnail_url: "https://example.com/ok.jpg",
        bedrooms: 3,
        bathrooms: 2,
        area: 180,
      },
      {
        id: "property-no-price",
        public_code: "V-101",
        title: "Apartamento no centro com varanda",
        price: null,
        type: "apartment",
        city: "São Sebastião",
        state: "SP",
        neighborhood: "Centro",
        thumbnail_url: "https://example.com/no-price.jpg",
        bedrooms: 2,
        bathrooms: 1,
        area: 74,
      },
      {
        id: "property-bad-image",
        public_code: "V-102",
        title: "Casa em condomínio com 4 quartos",
        price: 2200000,
        type: "house",
        city: "São Sebastião",
        state: "SP",
        neighborhood: "Camburi",
        thumbnail_url: "https://example.com/screenshot-dashboard.png",
        bedrooms: 4,
        bathrooms: 3,
        area: 210,
      },
    ])

    expect(curated).toHaveLength(1)
    expect(curated[0]?.id).toBe("property-ok")
    expect(isPresentablePublicTitle(curated[0]?.title)).toBe(true)
  })
})
