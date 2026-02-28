type PublishIssueKey =
  | "missing_city"
  | "missing_photo"
  | "missing_price"
  | "missing_type"
  | "short_description"

type PublishIssueSeverity = "blocking" | "warning"

export type PropertyPublishIssue = {
  key: PublishIssueKey
  severity: PublishIssueSeverity
  label: string
  focusFieldId:
    | "address_city"
    | "property-images"
    | "property-price"
    | "property-type"
    | "property-description"
}

type PublishReadinessInput = {
  address?: unknown
  images?: unknown
  image_paths?: unknown
  description?: string | null
  price?: number | null
  type?: string | null
}

function getAddressCity(address: unknown): string {
  if (!address || typeof address !== "object") return ""
  const city = (address as { city?: unknown }).city
  if (typeof city !== "string") return ""
  return city.trim()
}

function hasAnyImage(images: unknown, imagePaths: unknown): boolean {
  const hasUrl =
    Array.isArray(images) &&
    images.some((value) => typeof value === "string" && value.trim().length > 0)

  const hasPath =
    Array.isArray(imagePaths) &&
    imagePaths.some((value) => typeof value === "string" && value.trim().length > 0)

  return hasUrl || hasPath
}

function getDescription(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

function hasValidPrice(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function getPropertyPublishIssues(property: PublishReadinessInput): PropertyPublishIssue[] {
  const issues: PropertyPublishIssue[] = []

  if (!getAddressCity(property.address)) {
    issues.push({
      key: "missing_city",
      severity: "blocking",
      label: "Falta cidade no endereço",
      focusFieldId: "address_city",
    })
  }

  if (!hasAnyImage(property.images, property.image_paths)) {
    issues.push({
      key: "missing_photo",
      severity: "blocking",
      label: "Sem foto",
      focusFieldId: "property-images",
    })
  }

  if (!hasValidPrice(property.price)) {
    issues.push({
      key: "missing_price",
      severity: "blocking",
      label: "Preço ausente ou zerado",
      focusFieldId: "property-price",
    })
  }

  if (typeof property.type !== "string" || property.type.trim().length === 0) {
    issues.push({
      key: "missing_type",
      severity: "blocking",
      label: "Tipo do imóvel não informado",
      focusFieldId: "property-type",
    })
  }

  if (getDescription(property.description).length < 80) {
    issues.push({
      key: "short_description",
      severity: "warning",
      label: "Descrição ausente ou curta",
      focusFieldId: "property-description",
    })
  }

  return issues
}

export function isPropertyPublishReady(property: PublishReadinessInput): boolean {
  return !getPropertyPublishIssues(property).some((issue) => issue.severity === "blocking")
}

export function buildPropertyFixHref(propertyId: string, focusFieldId: PropertyPublishIssue["focusFieldId"]): string {
  return `/properties/${propertyId}?focus=${encodeURIComponent(focusFieldId)}`
}
