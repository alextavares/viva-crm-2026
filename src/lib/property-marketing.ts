import { getPropertyTypeCategory, getPropertyTypeMarketingLabel } from "@/lib/types"

export interface PropertyMarketingTitleInput {
    type?: string | null
    transactionType?: string | null
    bedrooms?: number | null
    bathrooms?: number | null
    area?: number | null
    neighborhood?: string | null
    city?: string | null
}

export function getTransactionMarketingLabel(transactionType?: string | null) {
    if (transactionType === "rent") return "para alugar"
    if (transactionType === "seasonal") return "para temporada"
    return "à venda"
}

export function buildSuggestedPropertyTitle({
    type,
    transactionType,
    bedrooms,
    neighborhood,
    city,
}: PropertyMarketingTitleInput) {
    return [
        getPropertyTypeMarketingLabel(type),
        bedrooms ? `com ${bedrooms} quarto${bedrooms > 1 ? "s" : ""}` : null,
        neighborhood ? `em ${neighborhood}` : city ? `em ${city}` : null,
        getTransactionMarketingLabel(transactionType),
    ]
        .filter(Boolean)
        .join(" ")
        .trim()
}

export function buildSuggestedPropertyDescription({
    type,
    transactionType,
    bedrooms,
    bathrooms,
    area,
    neighborhood,
    city,
}: PropertyMarketingTitleInput) {
    const marketingType = getPropertyTypeMarketingLabel(type)
    const location = neighborhood ? `${neighborhood}${city ? `, ${city}` : ""}` : city ?? ""
    const transactionText =
        transactionType === "rent"
            ? "disponível para locação"
            : transactionType === "seasonal"
                ? "disponível para temporada"
                : "disponível para venda"

    const structuralParts = [
        bedrooms ? `${bedrooms} quarto${bedrooms > 1 ? "s" : ""}` : null,
        bathrooms ? `${bathrooms} banheiro${bathrooms > 1 ? "s" : ""}` : null,
        area ? `${area} m² de área` : null,
    ].filter(Boolean)

    const firstSentence = `${marketingType} ${transactionText}${location ? ` em ${location}` : ""}.`
    const secondSentence =
        structuralParts.length > 0
            ? `O imóvel conta com ${structuralParts.join(", ")} e oferece uma base excelente para um anúncio mais competitivo.`
            : `O imóvel reúne características que merecem destaque na vitrine para atrair mais interessados.`
    const propertyTypeCategory = getPropertyTypeCategory(type)
    const thirdSentence =
        propertyTypeCategory === "commercial"
            ? "Uma opção interessante para quem busca visibilidade, localização e potencial comercial."
            : propertyTypeCategory === "land"
                ? "Uma boa oportunidade para quem procura localização e potencial de valorização."
                : "Uma boa oportunidade para quem busca localização, funcionalidade e potencial de valorização."

    return [firstSentence, secondSentence, thirdSentence].join(" ").trim()
}
