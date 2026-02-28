type Provider = "meta" | "twilio"

export type NormalizedWhatsAppLead = {
  provider: Provider
  external_id: string | null
  name: string
  phone: string
  message: string | null
}

type NormalizeResult = {
  leads: NormalizedWhatsAppLead[]
  skipped: number
}

function cleanText(value: unknown, max = 2000) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

function cleanPhone(value: unknown, max = 80) {
  if (typeof value !== "string") return null
  const normalized = value.replace(/^whatsapp:/i, "").trim()
  if (!normalized) return null
  return normalized.slice(0, max)
}

function toDisplayName(value: unknown, fallback = "Contato WhatsApp") {
  const parsed = cleanText(value, 120)
  return parsed || fallback
}

function extractMetaText(message: Record<string, unknown>) {
  const text = cleanText((message.text as { body?: unknown } | undefined)?.body)
  if (text) return text
  const button = cleanText((message.button as { text?: unknown } | undefined)?.text)
  if (button) return button
  const interactiveList = cleanText(
    (message.interactive as { list_reply?: { title?: unknown } } | undefined)?.list_reply?.title
  )
  if (interactiveList) return interactiveList
  const interactiveButton = cleanText(
    (message.interactive as { button_reply?: { title?: unknown } } | undefined)?.button_reply?.title
  )
  if (interactiveButton) return interactiveButton
  return null
}

function normalizeMeta(payload: unknown): NormalizeResult {
  const root = payload as { entry?: unknown[] }
  const entries = Array.isArray(root?.entry) ? root.entry : []
  const leads: NormalizedWhatsAppLead[] = []
  let skipped = 0

  for (const entry of entries) {
    const changes = Array.isArray((entry as { changes?: unknown[] })?.changes) ? (entry as { changes?: unknown[] }).changes! : []
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value || {}
      const contacts = Array.isArray(value.contacts) ? (value.contacts as Array<Record<string, unknown>>) : []
      const fallbackName = toDisplayName(
        (contacts[0]?.profile as { name?: unknown } | undefined)?.name || contacts[0]?.profile_name
      )
      const messages = Array.isArray(value.messages) ? (value.messages as Array<Record<string, unknown>>) : []

      if (messages.length === 0) {
        skipped += 1
        continue
      }

      for (const msg of messages) {
        const phone = cleanPhone(msg.from)
        const externalId = cleanText(msg.id, 200)
        const body = extractMetaText(msg)
        if (!phone) {
          skipped += 1
          continue
        }

        leads.push({
          provider: "meta",
          external_id: externalId,
          name: fallbackName,
          phone,
          message: body,
        })
      }
    }
  }

  return { leads, skipped }
}

function normalizeTwilio(payload: unknown): NormalizeResult {
  const body = payload as Record<string, unknown>
  const phone = cleanPhone(body.From)
  if (!phone) return { leads: [], skipped: 1 }

  const messageBody = cleanText(body.Body)
  const numMedia = Number(body.NumMedia || 0)
  const message = messageBody || (numMedia > 0 ? "Mensagem de mídia (sem texto)." : null)
  const externalId = cleanText(body.MessageSid || body.SmsMessageSid, 200)
  const name = toDisplayName(body.ProfileName)

  return {
    leads: [
      {
        provider: "twilio",
        external_id: externalId,
        name,
        phone,
        message,
      },
    ],
    skipped: 0,
  }
}

export function normalizeWhatsAppWebhookPayload(
  payload: unknown,
  providerHint?: string | null
): NormalizeResult {
  const hint = (providerHint || "").toLowerCase()
  if (hint === "twilio") return normalizeTwilio(payload)
  if (hint === "meta") return normalizeMeta(payload)

  const body = payload as Record<string, unknown>
  if (typeof body?.MessageSid === "string" || typeof body?.SmsMessageSid === "string" || typeof body?.From === "string") {
    return normalizeTwilio(payload)
  }
  if (Array.isArray((body as { entry?: unknown[] })?.entry)) {
    return normalizeMeta(payload)
  }

  return { leads: [], skipped: 1 }
}

