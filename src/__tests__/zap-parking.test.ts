/**
 * @jest-environment node
 */
import { POST as zapWebhook } from "@/app/api/public/webhooks/[slug]/zap/route"
import { GET as zapFeed } from "@/app/api/public/s/[slug]/zap-xml/route"

describe("zap canonical parking (410, no DB, no secrets, no PII logs)", () => {
  it("parks the zap webhook with a deterministic retired response", async () => {
    const res = await zapWebhook()
    expect(res.status).toBe(410)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.portal).toBe("zap_vivareal")
    expect(typeof body.message).toBe("string")
  })

  it("parks the zap xml feed with a deterministic retired response", async () => {
    const res = await zapFeed()
    expect(res.status).toBe(410)
    expect(res.headers.get("content-type")).toContain("application/xml")
    const text = await res.text()
    expect(text).toContain('retired="true"')
  })
})
