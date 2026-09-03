import { buildSuggestedPropertyDescription, buildSuggestedPropertyTitle } from "@/lib/property-marketing"

describe("property marketing helpers", () => {
    it("builds a suggested title with type, bedrooms, neighborhood and transaction", () => {
        expect(
            buildSuggestedPropertyTitle({
                type: "house",
                transactionType: "sale",
                bedrooms: 3,
                neighborhood: "Maresias",
                city: "São Sebastião",
            })
        ).toBe("Casa com 3 quartos em Maresias à venda")
    })

    it("falls back to city when neighborhood is missing", () => {
        expect(
            buildSuggestedPropertyTitle({
                type: "apartment",
                transactionType: "rent",
                bedrooms: 1,
                city: "Caraguatatuba",
            })
        ).toBe("Apartamento com 1 quarto em Caraguatatuba para alugar")
    })

    it("handles commercial variants", () => {
        expect(
            buildSuggestedPropertyTitle({
                type: "commercial_space",
                transactionType: "sale",
                city: "São Sebastião",
            })
        ).toBe("Imóvel comercial em São Sebastião à venda")
    })

    it("builds a suggested title for condominium houses", () => {
        expect(
            buildSuggestedPropertyTitle({
                type: "condominium_house",
                transactionType: "sale",
                bedrooms: 4,
                neighborhood: "Juquehy",
            })
        ).toBe("Casa em condomínio com 4 quartos em Juquehy à venda")
    })

    it("builds a suggested description with structure and location", () => {
        expect(
            buildSuggestedPropertyDescription({
                type: "house",
                transactionType: "sale",
                bedrooms: 3,
                bathrooms: 2,
                area: 120,
                neighborhood: "Maresias",
                city: "São Sebastião",
            })
        ).toContain("Casa disponível para venda em Maresias, São Sebastião.")
    })

    it("builds a commercial description fallback", () => {
        expect(
            buildSuggestedPropertyDescription({
                type: "commercial_space",
                transactionType: "rent",
                city: "Caraguatatuba",
            })
        ).toContain("Imóvel comercial disponível para locação em Caraguatatuba.")
    })
})
