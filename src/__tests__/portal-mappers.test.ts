import { generateImovelwebXml } from "@/lib/integrations/imovelweb-mapper"
import { generateZapXml, mapTransactionType, type CRMProperty } from "@/lib/integrations/zap-mapper"

function buildProperty(overrides: Partial<CRMProperty> = {}): CRMProperty {
  return {
    id: "property-1",
    external_id: null,
    public_code: "V-1001",
    title: "Casa de teste",
    description: "Descricao completa para teste de integracao com portais.",
    price: 500000,
    type: "house",
    transaction_type: "sale",
    status: "available",
    features: {
      bedrooms: 3,
      bathrooms: 2,
      area: 120,
    },
    address: {
      street: "Rua Central",
      neighborhood: "Centro",
      city: "Campinas",
      state: "SP",
      zip: "13000-000",
    },
    images: ["https://example.com/property-1.jpg"],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe("portal mappers", () => {
  it("maps rent and seasonal properties as for rent in Zap", () => {
    expect(mapTransactionType(buildProperty({ transaction_type: "rent" }))).toBe("For Rent")
    expect(mapTransactionType(buildProperty({ transaction_type: "seasonal" }))).toBe("For Rent")
    expect(mapTransactionType(buildProperty({ transaction_type: "sale" }))).toBe("For Sale")
  })

  it("renders rental purpose in Imovelweb and Zap XML", () => {
    const rentalProperty = buildProperty({ transaction_type: "rent" })

    const imovelwebXml = generateImovelwebXml([rentalProperty])
    const zapXml = generateZapXml([rentalProperty])

    expect(imovelwebXml).toContain("<Finalidade>Aluguel</Finalidade>")
    expect(imovelwebXml).toContain("<PrecoLocacao>500000</PrecoLocacao>")
    expect(zapXml).toContain("<TransactionType>For Rent</TransactionType>")
  })
})
