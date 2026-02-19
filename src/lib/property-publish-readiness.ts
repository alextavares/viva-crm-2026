type PublishIssueKey = "hidden" | "missing_city" | "missing_photo"

export type PropertyPublishIssue = {
  key: PublishIssueKey
  label: string
  focusFieldId: "property-site-visibility" | "address_city" | "property-images"
}

type PublishReadinessInput = {
  hide_from_site?: boolean | null
  address?: unknown
  images?: unknown
  image_paths?: unknown
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

export function getPropertyPublishIssues(property: PublishReadinessInput): PropertyPublishIssue[] {
  const issues: PropertyPublishIssue[] = []

  if (property.hide_from_site === true) {
    issues.push({
      key: "hidden",
      label: "Oculto do site",
      focusFieldId: "property-site-visibility",
    })
  }

  if (!getAddressCity(property.address)) {
    issues.push({
      key: "missing_city",
      label: "Falta cidade no endereço",
      focusFieldId: "address_city",
    })
  }

  if (!hasAnyImage(property.images, property.image_paths)) {
    issues.push({
      key: "missing_photo",
      label: "Sem foto",
      focusFieldId: "property-images",
    })
  }

  return issues
}

export function isPropertyPublishReady(property: PublishReadinessInput): boolean {
  return getPropertyPublishIssues(property).length === 0
}

export function buildPropertyFixHref(propertyId: string, focusFieldId: PropertyPublishIssue["focusFieldId"]): string {
  return `/properties/${propertyId}?focus=${encodeURIComponent(focusFieldId)}`
}

