import { mapUnivenRowToProperty, parseUnivenDecimal } from "@/lib/importers/univen"

describe("Univen importer", () => {
  it("parses implied 4-decimal money exports", () => {
    // Some CRMs export money as integer with 4 implied decimals: 2400000.0000 -> 24000000000
    expect(parseUnivenDecimal("24000000000")).toBe(2400000)
  })

  it("maps a minimal row into a property payload", () => {
    const row = {
      fkempresa: "914949",
      pkimovel: "70730209",
      internettitle: "Apartamento Teste",
      internetmetadescription: "Descricao curta",
      principalvalvenda: "550000.0000",
      principaltipo: "APARTAMENTO",
      principalsituacao: "ATIVO",
      principalendereco: "Rua A",
      principalnumero: "123",
      principalbairro: "Centro",
      principalcidade: "Sao Paulo",
      principaluf: "SP",
      principalcep: "01000-000",
      detalhedormitorios: "2",
      detalhebanheiros: "1",
      detalheareautil: "70",
      detalhegaragens: "1",
    }

    const images = ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"]
    const payload = mapUnivenRowToProperty(row, images)

    expect(payload).not.toBeNull()
    expect(payload!.external_id).toBe("univen:914949:70730209")
    expect(payload!.title).toBe("Apartamento Teste")
    expect(payload!.type).toBe("apartment")
    expect(payload!.status).toBe("available")
    expect(payload!.price).toBe(550000)
    expect(payload!.transaction_type).toBe("sale")
    expect(payload!.purpose).toBe("residential")
    expect(payload!.financing_allowed).toBe(false)
    expect(payload!.images.length).toBe(2)
    expect(payload!.address.city).toBe("Sao Paulo")
    expect(payload!.features.bedrooms).toBe(2)
  })

  it("uses locacao price and fills transaction, purpose and areas for rental rows", () => {
    const row = {
      fkempresa: "914949",
      pkimovel: "71157616",
      principalendereco: "RUA PERU",
      principalnumero: "252",
      principalbairro: "ENSEADA",
      principalcidade: "SAO SEBASTIAO",
      principaluf: "SP",
      principalcep: "11600-000",
      principalvenda: "0",
      principallocalacao: "1",
      principaltemporada: "0",
      principalvalvenda: "0.0000",
      principalvallocalacao: "800.0000",
      principaltipo: "CASA",
      principalsubtipo: "RESIDENCIAL",
      principalsituacao: "LOCADO",
      detalhedormitorios: "1",
      detalhebanheiros: "1",
      detalhegaragens: "1",
      detalhesuite: "1",
      principalaceitaf: "1",
      detalheareaconst: "100.00",
      detalheareatotal: "593.00",
      detalheareautil: "593.00",
    }

    const payload = mapUnivenRowToProperty(row, [])

    expect(payload).not.toBeNull()
    expect(payload!.price).toBe(800)
    expect(payload!.transaction_type).toBe("rent")
    expect(payload!.purpose).toBe("residential")
    expect(payload!.status).toBe("rented")
    expect(payload!.built_area).toBe(593)
    expect(payload!.total_area).toBe(593)
    expect(payload!.financing_allowed).toBe(true)
    expect(payload!.features.area).toBe(593)
    expect(payload!.features.suites).toBe(1)
  })

  it("prefers venda when the XML marks both venda and locacao", () => {
    const row = {
      fkempresa: "914949",
      pkimovel: "77629188",
      principalvenda: "1",
      principallocalacao: "1",
      principaltemporada: "0",
      principalvalvenda: "3000000.0000",
      principalvallocalacao: "20000.0000",
      principaltipo: "CASA",
      principalsubtipo: "RESIDENCIAL",
      principalsituacao: "ATIVO",
      detalhesuite: "3",
      detalheareaconst: "250.00",
      detalheareaterreno: "200.00",
      captacaocaptador: "Mateus Santos Tavares Moraes",
    }

    const payload = mapUnivenRowToProperty(row, [])

    expect(payload).not.toBeNull()
    expect(payload!.transaction_type).toBe("sale")
    expect(payload!.price).toBe(3000000)
    expect(payload!.built_area).toBe(250)
    expect(payload!.total_area).toBe(200)
    expect(payload!.features.suites).toBe(3)
    expect(payload!.assigned_to_hint).toBe("Mateus Santos Tavares Moraes")
  })
})
