import { normalizeWhatsAppWebhookPayload } from "@/lib/whatsapp-webhook-normalizer"

describe("normalizeWhatsAppWebhookPayload", () => {
  it("normalizes meta inbound text messages", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ profile: { name: "Cliente Meta" } }],
                messages: [
                  {
                    id: "wamid.HBgM1",
                    from: "5511999998888",
                    type: "text",
                    text: { body: "Olá, quero saber mais." },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    const result = normalizeWhatsAppWebhookPayload(payload, "meta")

    expect(result.leads).toHaveLength(1)
    expect(result.leads[0]).toMatchObject({
      provider: "meta",
      external_id: "wamid.HBgM1",
      name: "Cliente Meta",
      phone: "5511999998888",
      message: "Olá, quero saber mais.",
    })
  })

  it("skips meta payload with statuses only", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: "wamid.x", status: "delivered" }],
              },
            },
          ],
        },
      ],
    }

    const result = normalizeWhatsAppWebhookPayload(payload, "meta")

    expect(result.leads).toHaveLength(0)
    expect(result.skipped).toBeGreaterThan(0)
  })

  it("normalizes twilio payload", () => {
    const payload = {
      From: "whatsapp:+5511988877766",
      ProfileName: "Cliente Twilio",
      Body: "Tenho interesse no imóvel.",
      MessageSid: "SM123",
    }

    const result = normalizeWhatsAppWebhookPayload(payload, "twilio")

    expect(result.leads).toHaveLength(1)
    expect(result.leads[0]).toMatchObject({
      provider: "twilio",
      external_id: "SM123",
      name: "Cliente Twilio",
      phone: "+5511988877766",
      message: "Tenho interesse no imóvel.",
    })
  })

  it("auto-detects provider without hint", () => {
    const payload = {
      From: "whatsapp:+5511911112222",
      Body: "Oi",
      MessageSid: "SM-AUTO",
    }

    const result = normalizeWhatsAppWebhookPayload(payload)

    expect(result.leads).toHaveLength(1)
    expect(result.leads[0].provider).toBe("twilio")
  })
})

