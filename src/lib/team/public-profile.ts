import { z } from "zod"

import { digitsOnly } from "@/lib/whatsapp"

function trimmedOrNull(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export const brokerPublicProfileSchema = z.object({
  profileId: z.string().uuid("ID de perfil inválido."),
  public_profile_enabled: z.boolean(),
  public_display_name: z.preprocess(
    trimmedOrNull,
    z.string().min(2, "Nome público muito curto.").max(120, "Nome público muito longo.").nullable()
  ),
  creci: z.preprocess(
    trimmedOrNull,
    z.string().max(40, "CRECI muito longo.").nullable()
  ),
  public_whatsapp: z.preprocess(
    trimmedOrNull,
    z.string().max(40, "WhatsApp muito longo.").nullable()
  ),
  avatar_url: z.preprocess(
    trimmedOrNull,
    z.string().url("Informe uma URL válida para o avatar.").max(500, "URL do avatar muito longa.").nullable()
  ),
})
  .superRefine((value, ctx) => {
    if (!value.public_whatsapp) return

    const digits = digitsOnly(value.public_whatsapp)
    if (digits.length < 10 || digits.length > 13) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["public_whatsapp"],
        message: "Informe um WhatsApp válido com DDD.",
      })
    }
  })

export type BrokerPublicProfileInput = z.infer<typeof brokerPublicProfileSchema>

export function resolvePublicBrokerDisplayName(
  publicDisplayName?: string | null,
  fullName?: string | null
) {
  return trimmedOrNull(publicDisplayName) ?? trimmedOrNull(fullName)
}
