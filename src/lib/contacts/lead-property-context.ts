export type LeadPropertyReference = {
  id: string
  title: string | null
}

export type LeadPropertyContext = {
  id: string
  title: string
}

export type PropertyLookupRecord = {
  id: string
  title: string | null
  public_code: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function formatPropertyLabel(title: string, publicCode?: string | null) {
  const cleanCode = readString(publicCode)
  return cleanCode ? `[${cleanCode}] ${title}` : title
}

export function extractLeadPropertyReference(
  payload: Record<string, unknown> | null | undefined
): LeadPropertyReference | null {
  const metadata = asRecord(payload?.metadata)
  const propertyId =
    readString(payload?.property_id) ??
    readString(metadata?.property_id) ??
    readString(payload?.propertyId) ??
    readString(metadata?.propertyId)

  if (!propertyId) return null

  const title =
    readString(payload?.property_title) ??
    readString(metadata?.property_title) ??
    readString(payload?.propertyTitle) ??
    readString(metadata?.propertyTitle) ??
    readString(payload?.title) ??
    readString(metadata?.title)

  return {
    id: propertyId,
    title,
  }
}

export function collectLeadPropertyIds(
  references: Iterable<LeadPropertyReference | null | undefined>
) {
  return Array.from(
    new Set(
      Array.from(references)
        .map((reference) => reference?.id?.trim() ?? "")
        .filter(Boolean)
    )
  )
}

export function buildLeadPropertyContext(
  reference: LeadPropertyReference | null | undefined,
  propertyLookupById: Map<string, PropertyLookupRecord>
): LeadPropertyContext | null {
  if (!reference?.id) return null

  const lookup = propertyLookupById.get(reference.id) ?? null
  const title = readString(reference.title) ?? readString(lookup?.title)
  if (!title) return null

  return {
    id: reference.id,
    title: formatPropertyLabel(title, lookup?.public_code),
  }
}
