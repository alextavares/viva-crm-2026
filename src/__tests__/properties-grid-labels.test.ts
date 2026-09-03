import {
  portalSummary,
  propertySiteVisibilityBadge,
} from "@/components/properties/properties-grid"

describe("property card operational labels", () => {
  it("clarifies when portal distribution is disabled, incomplete, or active", () => {
    expect(
      portalSummary({
        publish_to_portals: false,
        publish_zap: false,
        publish_imovelweb: false,
        publish_olx: false,
      })
    ).toBe("Portais desligados")

    expect(
      portalSummary({
        publish_to_portals: true,
        publish_zap: false,
        publish_imovelweb: false,
        publish_olx: false,
      })
    ).toBe("Portais habilitados sem canal selecionado")

    expect(
      portalSummary({
        publish_to_portals: true,
        publish_zap: true,
        publish_imovelweb: false,
        publish_olx: true,
      })
    ).toBe("Enviado aos portais: ZAP · OLX")
  })

  it("clarifies site exposure as a manual toggle, not as final vitrine status", () => {
    expect(propertySiteVisibilityBadge({ status: "available" }, false).label).toBe("Exibição no site: ativa")
    expect(propertySiteVisibilityBadge({ status: "available" }, true).label).toBe("Exibição no site: oculta")
  })
})
