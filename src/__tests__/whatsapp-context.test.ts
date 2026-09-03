import {
  buildBrokerWhatsAppMessage,
  buildExternalWhatsAppTraceSummary,
} from "@/lib/whatsapp-context"

describe("buildBrokerWhatsAppMessage", () => {
  it("includes lead name and property context", () => {
    expect(
      buildBrokerWhatsAppMessage({
        contactName: "QA Rebaseline 958617",
        propertyTitle: "Apartamento demo no Centro",
        propertyCode: "DEMO-001",
      })
    ).toBe(
      'Olá QA, tudo bem? Vi seu interesse no imóvel "Apartamento demo no Centro" (Ref. DEMO-001). Posso te passar mais detalhes e combinar o próximo passo?'
    )
  })

  it("falls back to a specific lead greeting without property", () => {
    expect(
      buildBrokerWhatsAppMessage({
        contactName: "Maria",
      })
    ).toBe(
      "Olá Maria, tudo bem? Vi seu interesse e posso te ajudar com as próximas informações. Posso falar por aqui?"
    )
  })

  it("uses a neutral greeting when the contact name is missing", () => {
    expect(buildBrokerWhatsAppMessage({ contactName: null })).toContain("Olá, tudo bem?")
  })
})

describe("buildExternalWhatsAppTraceSummary", () => {
  it("records the property context in the trace summary", () => {
    expect(
      buildExternalWhatsAppTraceSummary({
        propertyTitle: "Apartamento demo no Centro",
        propertyCode: "DEMO-001",
      })
    ).toBe('WhatsApp externo aberto com contexto do imóvel "Apartamento demo no Centro" (Ref. DEMO-001).')
  })
})
