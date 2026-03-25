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
    const rentalProperty = buildProperty({
      transaction_type: "rent",
      features: {
        bedrooms: 3,
        bathrooms: 2,
        suite: 1,
        parking_spaces: 2,
        area_util: 120,
        area_total: 140,
        furnished: true,
        elevator: true,
        allows_pets: true,
        pool: true,
      },
      condo_fee: 750,
      iptu: 210,
    })

    const imovelwebXml = generateImovelwebXml([rentalProperty], {
      codigoImobiliaria: "47362968",
      tipoPublicacao: "DESTACADO",
      mostrarMapa: "APROXIMADO",
      localidadeMappingsRaw: "SP|Campinas=V1-D-513972",
      nomeContato: "Atendimento VivaCRM",
    })
    const zapXml = generateZapXml([rentalProperty])

    expect(imovelwebXml).toContain("<OpenNavent>")
    expect(imovelwebXml).toContain("<dataModificacao><![CDATA[")
    expect(imovelwebXml).toContain("<codigoAnuncio>V-1001</codigoAnuncio>")
    expect(imovelwebXml).toContain("<tipo>Casa</tipo>")
    expect(imovelwebXml).toContain("<operacao>ALUGUEL</operacao>")
    expect(imovelwebXml).toContain("<codigoImobiliaria>47362968</codigoImobiliaria>")
    expect(imovelwebXml).toContain("<idLocalidade>V1-D-513972</idLocalidade>")
    expect(imovelwebXml).toContain("<nome>PRINCIPALES|QUARTO</nome>")
    expect(imovelwebXml).toContain("<nome>PRINCIPALES|VAGA</nome>")
    expect(imovelwebXml).toContain("<valor>2</valor>")
    expect(imovelwebXml).toContain("<nome>MEDIDAS|AREA_TOTAL</nome>")
    expect(imovelwebXml).toContain("<valor>140</valor>")
    expect(imovelwebXml).toContain("<nome>AREA_PRIVATIVA|MOBILIADO</nome>")
    expect(imovelwebXml).toContain("<nome>AREAS_COMUNS|ELEVADOR</nome>")
    expect(imovelwebXml).toContain("<nome>AREA_PRIVATIVA|PERMITE_ANIMAIS</nome>")
    expect(imovelwebXml).toContain("<nome>AREAS_COMUNS|PISCINA</nome>")
    expect(imovelwebXml).toContain("<mostrarMapa>APROXIMADO</mostrarMapa>")
    expect(imovelwebXml).toContain("<tipoPublicacao><![CDATA[DESTACADO]]></tipoPublicacao>")
    expect(zapXml).toContain("<TransactionType>For Rent</TransactionType>")
  })

  it("supports documented publication types, localidade fallback and EXATO alias", () => {
    const property = buildProperty({
      address: {
        street: "Rua Central",
        city: "Campinas",
        state: "SP",
        localidade: "Campinas",
      },
    })

    const imovelwebXml = generateImovelwebXml([property], {
      tipoPublicacao: "gratis",
      mostrarMapa: "EXATO",
    })

    expect(imovelwebXml).toContain("<tipoPublicacao><![CDATA[GRATIS]]></tipoPublicacao>")
    expect(imovelwebXml).toContain("<mostrarMapa>EXACTO</mostrarMapa>")
    expect(imovelwebXml).toContain("<localidade>Campinas</localidade>")
    expect(imovelwebXml).not.toContain("<idLocalidade>")
  })

  it("uses neighborhood-level localidade mappings when available", () => {
    const property = buildProperty({
      type: "house",
      address: {
        street: "Rua da Praia",
        neighborhood: "Maresias",
        city: "São Sebastião",
        state: "SP",
        zip: "11628-000",
      },
    })

    const imovelwebXml = generateImovelwebXml([property], {
      localidadeMappingsRaw: "SP|São Sebastião=V1-C-109673\nSP|São Sebastião|Maresias=V1-D-499784",
    })

    expect(imovelwebXml).toContain("<idLocalidade>V1-D-499784</idLocalidade>")
  })

  it("uses official sandbox subtypes for condominium houses and commercial spaces", () => {
    const condominiumXml = generateImovelwebXml([buildProperty({ type: "condominium_house" })])
    const commercialXml = generateImovelwebXml([buildProperty({ type: "commercial_space" })])

    expect(condominiumXml).toContain("<idTipo>1</idTipo>")
    expect(condominiumXml).toContain("<idSubTipo>6</idSubTipo>")
    expect(condominiumXml).toContain("<subTipo>Casa de Condomínio</subTipo>")

    expect(commercialXml).toContain("<idTipo>1005</idTipo>")
    expect(commercialXml).toContain("<idSubTipo>19</idSubTipo>")
    expect(commercialXml).toContain("<subTipo>Loja/Salão</subTipo>")
  })
})
