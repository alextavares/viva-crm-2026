import { deriveImovelwebEventId } from "@/lib/integrations/imovelweb-webhook"
import { toFeedProperty } from "@/lib/integrations/imovelweb-feed"
import {
  applyPublicSiteFilter,
  getPublicPropertyList,
} from "@/lib/public-site/site-data"
import {
  getAttemptMessage,
  getReasonFromStatus,
} from "@/lib/ai-leads/reengagement"
import {
  siteCreateLead,
  siteListProperties,
  toSitePropertyCard,
} from "@/lib/site"

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}))

function fakeClient(rpcImpl: jest.Mock) {
  return { schema: jest.fn().mockReturnValue({ rpc: rpcImpl }) } as never
}

function expectApiSchema(client: { schema: jest.Mock }) {
  expect(client.schema).toHaveBeenCalledWith("api")
}

describe("canonical imovelweb boundary", () => {
  it("prefers an explicit portal event id, bounded to 200 chars", () => {
    expect(
      deriveImovelwebEventId({ eventId: " evt-123 ", phoneNorm: "551199", listingRef: "A", message: "hi" })
    ).toBe("evt-123")
    expect(deriveImovelwebEventId({ eventId: "x".repeat(500) }).length).toBe(200)
  })

  it("derives a deterministic idempotency key without an explicit id", () => {
    const a = deriveImovelwebEventId({ phoneNorm: "551199", listingRef: "A", message: "hi" })
    const b = deriveImovelwebEventId({ phoneNorm: "551199", listingRef: "A", message: "hi" })
    const c = deriveImovelwebEventId({ phoneNorm: "551199", listingRef: "B", message: "hi" })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a.startsWith("derived-")).toBe(true)
  })

  it("maps feed rows onto the mapper input with public_code identity", () => {
    const card = toFeedProperty(
      {
        external_id: "ext-1",
        public_code: "ABC123",
        title: "Casa",
        description: null,
        type: "house",
        transaction_type: "sale",
        price: 500000,
        built_area: 120,
        total_area: null,
        address: { city: "SP", neighborhood: "Centro" },
        image_paths: [],
        publication_status: "published",
      },
      0
    )
    expect(card.id).toBe("ABC123")
    expect(card.public_code).toBe("ABC123")
    expect(card.status).toBe("available")
    expect(Array.isArray(card.images)).toBe(true)
  })
})

describe("canonical site RPC signatures", () => {
  it("calls site_list_properties with p_slug/p_page/p_page_size", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [], error: null })
    const client = fakeClient(rpc)
    await siteListProperties(client, { slug: "acme", page: 2, pageSize: 24 })
    expectApiSchema(client)
    expect(rpc).toHaveBeenCalledWith("site_list_properties", {
      p_slug: "acme",
      p_page: 2,
      p_page_size: 24,
    })
  })

  it("calls site_create_lead with the canonical eight-arg shape", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: { accepted: true, deduped: false, reference: "c1" }, error: null })
    const client = fakeClient(rpc)
    await siteCreateLead(client, {
      slug: "acme",
      name: "Lia",
      phone: "+5511999999999",
      propertyId: null,
      message: "oi",
      sourceDomain: "acme.example",
      idempotencyKey: "k1",
    })
    expectApiSchema(client)
    expect(rpc).toHaveBeenCalledWith("site_create_lead", {
      p_slug: "acme",
      p_name: "Lia",
      p_phone: "+5511999999999",
      p_email: null,
      p_property_id: null,
      p_message: "oi",
      p_source_domain: "acme.example",
      p_idempotency_key: "k1",
    })
  })

  it("identifies cards by public_code with canonical projections", () => {
    const card = toSitePropertyCard({
      public_code: "XYZ9",
      external_id: null,
      title: "Apto",
      description: null,
      type: "apartment",
      transaction_type: "rent",
      price: 2500,
      built_area: 70,
      total_area: null,
      address: { city: "Campinas", neighborhood: null },
      features: null,
      image_paths: ["a.jpg"],
    })
    expect(card.id).toBe("XYZ9")
    expect(card.thumbnail_path).toBe("a.jpg")
    expect(card.city).toBe("Campinas")
    expect(card.area).toBe(70)
  })

  it("filters the bounded page in memory (no server-side search params)", () => {
    const cards = [
      { id: "A", public_code: "A", title: "Casa Centro", price: 500000, type: "house", city: "SP", state: null, neighborhood: null, thumbnail_url: null, bedrooms: null, bathrooms: null, area: null },
      { id: "B", public_code: "B", title: "Apto Norte", price: 300000, type: "apartment", city: "SP", state: null, neighborhood: null, thumbnail_url: null, bedrooms: null, bathrooms: null, area: null },
    ]
    expect(applyPublicSiteFilter(cards, { type: "house" }).map((c) => c.id)).toEqual(["A"])
    expect(applyPublicSiteFilter(cards, { minPrice: 400000 }).map((c) => c.id)).toEqual(["A"])
    expect(applyPublicSiteFilter(cards, { q: "norte" }).map((c) => c.id)).toEqual(["B"])
    expect(getPublicPropertyList).toBeDefined()
  })
})

describe("canonical reengagement helpers", () => {
  it("maps canonical session statuses to reasons", () => {
    expect(getReasonFromStatus("active")).toBe("no_reply_after_first_message")
    expect(getReasonFromStatus("qualified")).toBe("qualified_without_human_action")
    expect(getReasonFromStatus("handed_off")).toBe("handoff_without_human_action")
    expect(getReasonFromStatus("paused")).toBeNull()
    expect(getReasonFromStatus("closed")).toBeNull()
  })

  it("builds attempt messages with name interpolation", () => {
    const settings = {
      enabled: true,
      firstDelayMinutes: 15,
      secondDelayMinutes: 120,
      thirdDelayMinutes: 1440,
      inactiveMessageTemplate: "Olá {{first_name}}!",
      handoffMessageTemplate: "Oi {{first_name}}!",
      slaMinutes: 30,
      finalEscalationDelayMinutes: 30,
      notifyBroker: true,
      notifyManager: false,
    }
    expect(getAttemptMessage(settings, "no_reply_after_first_message", "Lia Souza", 1)).toBe("Olá Lia!")
    expect(getAttemptMessage(settings, "handoff_without_human_action", null, 3)).toContain("Oi cliente!")
  })
})
