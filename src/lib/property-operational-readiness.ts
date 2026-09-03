import { propertyTypeRequiresBathrooms, propertyTypeRequiresBedrooms } from "@/lib/types"

export type PropertyOperationalStatus =
  | "draft"
  | "publishable"
  | "published_low_quality"
  | "published_high_quality"

export type PropertyOperationalIssueSeverity = "critical" | "light"

export type PropertyOperationalIssueCode =
  | "missing_type"
  | "missing_transaction_type"
  | "missing_price"
  | "missing_area"
  | "missing_bedrooms"
  | "missing_bathrooms"
  | "missing_city"
  | "missing_neighborhood"
  | "missing_responsible"
  | "weak_title"
  | "missing_description"
  | "missing_images"
  | "few_images"
  | "weak_description"

export type PropertyOperationalIssueGroup =
  | "essentials"
  | "location"
  | "responsibility"
  | "commercial"
  | "media"

export type PropertyOperationalFocusFieldId =
  | "property-title"
  | "property-type"
  | "property-transaction-type"
  | "property-price"
  | "property-area"
  | "property-bedrooms"
  | "property-bathrooms"
  | "address_city"
  | "address_neighborhood"
  | "property-responsible"
  | "property-description"
  | "property-images"

export type PropertyOperationalIssue = {
  code: PropertyOperationalIssueCode
  label: string
  severity: PropertyOperationalIssueSeverity
  group: PropertyOperationalIssueGroup
  focusFieldId: PropertyOperationalFocusFieldId
}

export type NormalizedProperty = {
  id?: string | null
  code: string
  title: string
  titleLength: number
  propertyType: string
  transactionType: string
  price: number | null
  area: number | null
  bedrooms: number | null
  bathrooms: number | null
  city: string
  neighborhood: string
  addressLine: string
  responsibleId: string
  description: string
  descriptionLength: number
  imageCount: number
  hasCoverImage: boolean
  isPublished: boolean
  activeChannels: string[]
  hasType: boolean
  hasTransactionType: boolean
  hasPrice: boolean
  hasArea: boolean
  hasBedrooms: boolean
  hasBathrooms: boolean
  hasMinimalLocation: boolean
  hasResponsible: boolean
  hasDescription: boolean
  hasImages: boolean
  hasEnoughImages: boolean
}

export type PropertyOperationalSnapshot = {
  normalized: NormalizedProperty
  criticalIssues: PropertyOperationalIssue[]
  lightIssues: PropertyOperationalIssue[]
  displayIssues: PropertyOperationalIssue[]
  status: PropertyOperationalStatus
  reasonSummary: string
  counts: {
    critical: number
    light: number
  }
}

type RawProperty = {
  id?: unknown
  public_code?: unknown
  external_id?: unknown
  title?: unknown
  type?: unknown
  transaction_type?: unknown
  price?: unknown
  description?: unknown
  assigned_to?: unknown
  status?: unknown
  hide_from_site?: unknown
  publish_to_portals?: unknown
  publish_zap?: unknown
  publish_imovelweb?: unknown
  publish_olx?: unknown
  images?: unknown
  image_paths?: unknown
  features?: unknown
  address?: unknown
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function getNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

function getAddressPart(address: unknown, key: string): string {
  if (!address || typeof address !== "object") return ""
  return getString((address as Record<string, unknown>)[key])
}

function getFeatureNumber(features: unknown, key: string): number | null {
  if (!features || typeof features !== "object") return null
  return getNumber((features as Record<string, unknown>)[key])
}

function getArrayCount(value: unknown): number {
  if (!Array.isArray(value)) return 0
  return value.filter((item) => typeof item === "string" && item.trim().length > 0).length
}

function getActiveChannels(raw: RawProperty): string[] {
  const channels: string[] = []
  const status = getString(raw.status)
  const hideFromSite = raw.hide_from_site === true

  if (!hideFromSite && status === "available") {
    channels.push("site")
  }

  const publishToPortals = raw.publish_to_portals === true
  if (publishToPortals) {
    channels.push("portals")
  }
  if (raw.publish_zap === true) channels.push("zap")
  if (raw.publish_imovelweb === true) channels.push("imovelweb")
  if (raw.publish_olx === true) channels.push("olx")

  return Array.from(new Set(channels))
}

export function normalizeProperty(raw: RawProperty): NormalizedProperty {
  const city = getAddressPart(raw.address, "city")
  const neighborhood = getAddressPart(raw.address, "neighborhood")
  const addressLine =
    getAddressPart(raw.address, "full_address") ||
    [neighborhood, city, getAddressPart(raw.address, "state")].filter(Boolean).join(" - ")

  const description = getString(raw.description)
  const imageCount = Math.max(getArrayCount(raw.images), getArrayCount(raw.image_paths))
  const activeChannels = getActiveChannels(raw)
  const price = getNumber(raw.price)
  const area = getFeatureNumber(raw.features, "area")
  const bedrooms = getFeatureNumber(raw.features, "bedrooms")
  const bathrooms = getFeatureNumber(raw.features, "bathrooms")
  const responsibleId = getString(raw.assigned_to)
  const propertyType = getString(raw.type)
  const transactionType = getString(raw.transaction_type)
  const title = getString(raw.title)

  return {
    id: typeof raw.id === "string" ? raw.id : null,
    code: getString(raw.public_code) || getString(raw.external_id) || getString(raw.id),
    title,
    titleLength: title.length,
    propertyType,
    transactionType,
    price,
    area,
    bedrooms,
    bathrooms,
    city,
    neighborhood,
    addressLine,
    responsibleId,
    description,
    descriptionLength: description.length,
    imageCount,
    hasCoverImage: imageCount > 0,
    isPublished: activeChannels.length > 0,
    activeChannels,
    hasType: propertyType.length > 0,
    hasTransactionType: transactionType.length > 0,
    hasPrice: typeof price === "number" && price > 0,
    hasArea: typeof area === "number" && area > 0,
    hasBedrooms: typeof bedrooms === "number" && bedrooms > 0,
    hasBathrooms: typeof bathrooms === "number" && bathrooms > 0,
    hasMinimalLocation: city.length > 0 && neighborhood.length > 0,
    hasResponsible: responsibleId.length > 0,
    hasDescription: description.length > 0,
    hasImages: imageCount > 0,
    hasEnoughImages: imageCount >= 5,
  }
}

function issue(
  code: PropertyOperationalIssueCode,
  label: string,
  severity: PropertyOperationalIssueSeverity,
  group: PropertyOperationalIssueGroup,
  focusFieldId: PropertyOperationalFocusFieldId
): PropertyOperationalIssue {
  return { code, label, severity, group, focusFieldId }
}

const ISSUE_PRIORITY: Record<PropertyOperationalIssueCode, number> = {
  missing_price: 100,
  missing_type: 95,
  missing_transaction_type: 90,
  missing_area: 88,
  missing_bedrooms: 84,
  missing_bathrooms: 82,
  missing_city: 85,
  missing_neighborhood: 80,
  missing_responsible: 75,
  weak_title: 68,
  missing_images: 70,
  missing_description: 65,
  few_images: 40,
  weak_description: 35,
}

export function getPropertyOperationalIssues(
  normalized: NormalizedProperty
): {
  criticalIssues: PropertyOperationalIssue[]
  lightIssues: PropertyOperationalIssue[]
  displayIssues: PropertyOperationalIssue[]
} {
  const criticalIssues: PropertyOperationalIssue[] = []
  const lightIssues: PropertyOperationalIssue[] = []

  if (!normalized.hasType) {
    criticalIssues.push(issue("missing_type", "Sem tipo", "critical", "essentials", "property-type"))
  }

  if (!normalized.hasTransactionType) {
    criticalIssues.push(
      issue(
        "missing_transaction_type",
        "Sem finalidade",
        "critical",
        "essentials",
        "property-transaction-type"
      )
    )
  }

  if (!normalized.hasPrice) {
    criticalIssues.push(issue("missing_price", "Sem preço", "critical", "essentials", "property-price"))
  }

  if (!normalized.hasArea) {
    lightIssues.push(issue("missing_area", "Sem área", "light", "essentials", "property-area"))
  }

  if (!normalized.city) {
    criticalIssues.push(issue("missing_city", "Sem cidade", "critical", "location", "address_city"))
  }

  if (!normalized.neighborhood) {
    criticalIssues.push(
      issue("missing_neighborhood", "Sem bairro", "critical", "location", "address_neighborhood")
    )
  }

  if (!normalized.hasResponsible) {
    criticalIssues.push(
      issue("missing_responsible", "Sem responsável", "critical", "responsibility", "property-responsible")
    )
  }

  if (normalized.titleLength < 18) {
    lightIssues.push(
      issue("weak_title", "Título fraco", "light", "commercial", "property-title")
    )
  }

  if (propertyTypeRequiresBedrooms(normalized.propertyType) && !normalized.hasBedrooms) {
    lightIssues.push(
      issue("missing_bedrooms", "Sem quartos", "light", "essentials", "property-bedrooms")
    )
  }

  if (propertyTypeRequiresBathrooms(normalized.propertyType) && !normalized.hasBathrooms) {
    lightIssues.push(
      issue("missing_bathrooms", "Sem banheiros", "light", "essentials", "property-bathrooms")
    )
  }

  if (!normalized.hasImages) {
    criticalIssues.push(issue("missing_images", "Sem fotos", "critical", "media", "property-images"))
  } else if (!normalized.hasEnoughImages) {
    lightIssues.push(issue("few_images", "Galeria fraca", "light", "media", "property-images"))
  }

  if (!normalized.hasDescription) {
    criticalIssues.push(
      issue("missing_description", "Sem descrição", "critical", "commercial", "property-description")
    )
  } else if (normalized.descriptionLength < 80) {
    lightIssues.push(
      issue("weak_description", "Descrição fraca", "light", "commercial", "property-description")
    )
  }

  const displayIssues = [...criticalIssues, ...lightIssues]
    .sort((a, b) => ISSUE_PRIORITY[b.code] - ISSUE_PRIORITY[a.code])
    .slice(0, 3)

  return { criticalIssues, lightIssues, displayIssues }
}

export function getPropertyOperationalStatus(args: {
  isPublished: boolean
  criticalIssues: PropertyOperationalIssue[]
  lightIssues: PropertyOperationalIssue[]
}): {
  status: PropertyOperationalStatus
  reasonSummary: string
} {
  const { isPublished, criticalIssues, lightIssues } = args

  if (criticalIssues.length > 0) {
    return {
      status: "draft",
      reasonSummary: `Faltam ${criticalIssues
        .slice(0, 2)
        .map((issue) => issue.label.toLowerCase())
        .join(" e ")}`,
    }
  }

  if (!isPublished) {
    return {
      status: "publishable",
      reasonSummary:
        lightIssues.length > 0
          ? `Pronto para publicar, mas com ${lightIssues
              .slice(0, 1)
              .map((issue) => issue.label.toLowerCase())
              .join("")}`
          : "Pronto para publicar",
    }
  }

  if (lightIssues.length > 0) {
    return {
      status: "published_low_quality",
      reasonSummary: `Publicado, mas com ${lightIssues
        .slice(0, 2)
        .map((issue) => issue.label.toLowerCase())
        .join(" e ")}`,
    }
  }

  return {
    status: "published_high_quality",
    reasonSummary: "Publicado sem pendências relevantes",
  }
}

export function getPropertyOperationalSnapshot(raw: RawProperty): PropertyOperationalSnapshot {
  const normalized = normalizeProperty(raw)
  const { criticalIssues, lightIssues, displayIssues } = getPropertyOperationalIssues(normalized)
  const { status, reasonSummary } = getPropertyOperationalStatus({
    isPublished: normalized.isPublished,
    criticalIssues,
    lightIssues,
  })

  return {
    normalized,
    criticalIssues,
    lightIssues,
    displayIssues,
    status,
    reasonSummary,
    counts: {
      critical: criticalIssues.length,
      light: lightIssues.length,
    },
  }
}

export function getPropertyOperationalStatusLabel(status: PropertyOperationalStatus): string {
  if (status === "draft") return "Rascunho"
  if (status === "publishable") return "Publicável"
  if (status === "published_low_quality") return "Publicado com baixa qualidade"
  return "Publicado com alta qualidade"
}
