import { z } from "zod"

export const WEBHOOK_SOURCES = [
  "site",
  "portal_zap",
  "portal_olx",
  "portal_imovelweb",
  "email_capture",
] as const

export type WebhookSource = (typeof WEBHOOK_SOURCES)[number]

export const webhookLeadPayloadSchema = z.object({
  // Optional because the token can imply the source; when provided it must match the token source.
  source: z.enum(WEBHOOK_SOURCES).optional().nullable(),
  external_id: z.string().min(1).max(200).optional().nullable(),
  name: z.string().min(1).max(120),
  phone: z.string().min(4).max(80),
  email: z.string().email().max(180).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
})

export type WebhookLeadPayload = z.infer<typeof webhookLeadPayloadSchema>

export type WebhookIngestResult = {
  organization_id: string
  contact_id: string
  message_inserted: boolean
}

export function safeParseWebhookLeadPayload(input: unknown) {
  return webhookLeadPayloadSchema.safeParse(input)
}

