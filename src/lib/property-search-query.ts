export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

export function sanitizePropertySearch(value: string) {
  return value.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim()
}

export function buildPropertySearchOrTerms(value: string) {
  const raw = value.trim()
  const sanitized = sanitizePropertySearch(raw)
  const digits = sanitized.replace(/[^0-9]/g, "")
  const terms: string[] = []

  if (sanitized) {
    terms.push(`title.ilike.%${sanitized}%`)
    terms.push(`public_code.ilike.%${sanitized}%`)
    terms.push(`external_id.ilike.%${sanitized}%`)
    terms.push(`owner_name.ilike.%${sanitized}%`)
  }

  if (digits && digits !== sanitized) {
    terms.push(`public_code.ilike.%${digits}%`)
    terms.push(`external_id.ilike.%${digits}%`)
  }

  if (isUuid(raw)) {
    terms.push(`id.eq.${raw}`)
  }

  return Array.from(new Set(terms))
}
