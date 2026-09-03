import { decodePropertyFeatures, encodePropertyFeatures } from "@/lib/properties/features-codec"

describe("features codec", () => {
    it("encodes positive numbers as canonical text[] tokens", () => {
        expect(encodePropertyFeatures({ bedrooms: 3, bathrooms: 2, area: 120 })).toEqual([
            "bedrooms:3",
            "bathrooms:2",
            "area:120",
        ])
    })

    it("drops zero, negative and non-numeric inputs", () => {
        expect(encodePropertyFeatures({ bedrooms: 0, bathrooms: -1, area: "abc" })).toEqual([])
    })

    it("decodes tokens back to the form object", () => {
        expect(decodePropertyFeatures(["bedrooms:3", "bathrooms:2", "area:120"])).toEqual({
            bedrooms: 3,
            bathrooms: 2,
            area: 120,
        })
    })

    it("ignores unknown tokens and garbage entries", () => {
        expect(decodePropertyFeatures(["bedrooms:2", "pool:1", "no-separator", 42, null])).toEqual({
            bedrooms: 2,
            bathrooms: 0,
            area: 0,
        })
    })

    it("passes legacy object rows through", () => {
        expect(decodePropertyFeatures({ bedrooms: 4, bathrooms: 1 })).toEqual({
            bedrooms: 4,
            bathrooms: 1,
            area: 0,
        })
    })

    it("round-trips form values", () => {
        const form = { bedrooms: 3, bathrooms: 2, area: 95.5 }
        expect(decodePropertyFeatures(encodePropertyFeatures(form))).toEqual(form)
    })
})
