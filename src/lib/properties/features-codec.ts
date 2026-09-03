import type { PropertyFeatures } from "@/lib/types"

const TOKEN_KEYS = ["bedrooms", "bathrooms", "area"] as const

type TokenKey = (typeof TOKEN_KEYS)[number]

function toStoredNumber(value: unknown): number | null {
    const numeric = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) return null
    return numeric
}

export function encodePropertyFeatures(input: {
    bedrooms?: unknown
    bathrooms?: unknown
    area?: unknown
}): string[] {
    const tokens: string[] = []
    for (const key of TOKEN_KEYS) {
        const value = toStoredNumber(input[key])
        if (value != null) tokens.push(`${key}:${value}`)
    }
    return tokens
}

export function decodePropertyFeatures(features: unknown): PropertyFeatures {
    const result: PropertyFeatures = { bedrooms: 0, bathrooms: 0, area: 0 }
    if (Array.isArray(features)) {
        for (const entry of features) {
            if (typeof entry !== "string") continue
            const separator = entry.indexOf(":")
            if (separator < 0) continue
            const key = entry.slice(0, separator).trim()
            if (!(TOKEN_KEYS as readonly string[]).includes(key)) continue
            const value = Number(entry.slice(separator + 1).trim())
            if (Number.isFinite(value) && value >= 0) {
                result[key as TokenKey] = value
            }
        }
        return result
    }
    if (features && typeof features === "object") {
        const record = features as Record<string, unknown>
        for (const key of TOKEN_KEYS) {
            const value = record[key]
            if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
                result[key] = value
            }
        }
    }
    return result
}
