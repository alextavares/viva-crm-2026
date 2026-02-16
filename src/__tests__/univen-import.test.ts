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
    expect(payload!.images.length).toBe(2)
    expect(payload!.address.city).toBe("Sao Paulo")
    expect(payload!.features.bedrooms).toBe(2)
  })
})
