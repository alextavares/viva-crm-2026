import {
  getPropertyVitrineStatus,
  type PropertyVitrineStatus,
} from "@/lib/property-vitrine-status"

const baseProperty = {
  id: "property-1",
  title: "Apartamento reformado no Centro",
  description:
    "Apartamento claro, bem localizado, com boa ventilacao e pronto para visita com atendimento consultivo.",
  price: 450000,
  status: "available",
  hide_from_site: false,
  images: ["cover.jpg", "sala.jpg", "quarto.jpg", "cozinha.jpg", "fachada.jpg"],
  image_paths: [],
}

function expectStatus(input: Partial<typeof baseProperty>, expected: PropertyVitrineStatus) {
  expect(getPropertyVitrineStatus({ ...baseProperty, ...input }).status).toBe(expected)
}

describe("getPropertyVitrineStatus", () => {
  it("marks available curated properties as live when site exposure is enabled", () => {
    const status = getPropertyVitrineStatus(baseProperty)
    expect(status.status).toBe("live")
    expect(status.label).toBe("Publicado no site")
  })

  it("marks curated but hidden properties as ready to release", () => {
    const status = getPropertyVitrineStatus({ ...baseProperty, hide_from_site: true })
    expect(status.status).toBe("ready_hidden")
    expect(status.label).toBe("Pronto para publicar")
  })

  it("marks visible properties with curation blockers as blocked, not live", () => {
    const status = getPropertyVitrineStatus({ ...baseProperty, title: "Teste", hide_from_site: false })
    expect(status.status).toBe("blocked_visible")
    expect(status.label).toBe("Com pendências")
    expect(status.shortLabel).toBe("Publicado com pendências")
  })

  it("marks hidden properties with curation blockers as blocked and hidden", () => {
    const status = getPropertyVitrineStatus({ ...baseProperty, title: "Teste", hide_from_site: true })
    expect(status.status).toBe("blocked_hidden")
    expect(status.label).toBe("Com pendências")
    expect(status.shortLabel).toBe("Oculto com pendências")
  })

  it("marks unavailable properties as outside vitrine regardless of exposure toggle", () => {
    expectStatus({ status: "sold", hide_from_site: false }, "off_market")
  })
})
