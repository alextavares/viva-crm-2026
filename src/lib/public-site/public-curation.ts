import type { PropertyOperationalFocusFieldId } from "@/lib/property-operational-readiness"
import type { SitePropertyCard, SitePublicBanner, SiteBannerPlacement } from "@/lib/site"

const SUSPICIOUS_BANNER_TEXT_PATTERNS = [
  /\btopbar\b/i,
  /\bsite demo\b/i,
  /\btemplate\b/i,
  /\bsearch[- ]first\b/i,
  /\bteste?s?\b/i,
  /\bbanner hero\b/i,
]

const SUSPICIOUS_PROPERTY_TITLE_PATTERNS = [
  /\btestse\b/i,
  /\bteste?s?\b/i,
  /\bdemo\b/i,
  /\blorem\b/i,
  /\bsem titulo\b/i,
  /\basdf\b/i,
  /\bqwer\b/i,
]

const SUSPICIOUS_MEDIA_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/i,
  /screenshot/i,
  /screen[-_ ]?shot/i,
  /captura/i,
  /dashboard/i,
  /whatsapp/i,
  /browser/i,
  /chrome/i,
  /tool/i,
]

export type PublicCurationReasonCode =
  | "weak_title"
  | "missing_price"
  | "missing_images"
  | "suspicious_media"
  | "missing_description"
  | "weak_description"
  | "few_images"

export type PublicCurationReason = {
  code: PublicCurationReasonCode
  label: string
  severity: "critical" | "light"
  focusFieldId: PropertyOperationalFocusFieldId
}

export type PublicCurationSnapshot = {
  blockingReasons: PublicCurationReason[]
  warningReasons: PublicCurationReason[]
  displayReasons: PublicCurationReason[]
  hiddenFromVitrine: boolean
  readyForVitrine: boolean
  canPublishNow: boolean
  visibleOnPublicSite: boolean
  reasonSummary: string
}

export type PublicSiteReleaseReadiness = {
  commerciallyAvailable: boolean
  readyToRelease: boolean
  blockedByCuration: boolean
  liveOnPublicSite: boolean
}

type PublicCuratableProperty = Partial<SitePropertyCard> & {
  title?: string | null
  price?: number | null
  description?: string | null
  images?: string[] | null
  image_paths?: string[] | null
  thumbnail_url?: string | null
  thumbnail_path?: string | null
  hide_from_site?: boolean | null
  status?: string | null
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function matchesAnyPattern(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value))
}

function getArrayItems(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function hasOwnProperty(value: unknown, key: string) {
  return Boolean(value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key))
}

function issue(
  code: PublicCurationReasonCode,
  label: string,
  severity: "critical" | "light",
  focusFieldId: PropertyOperationalFocusFieldId
): PublicCurationReason {
  return { code, label, severity, focusFieldId }
}

export function isSuspiciousPublicMedia(source: string | null | undefined) {
  const normalized = normalizeText(source)
  if (!normalized) return false
  return matchesAnyPattern(normalized, SUSPICIOUS_MEDIA_PATTERNS)
}

export function isPresentablePublicTitle(title: string | null | undefined) {
  const normalized = normalizeText(title)
  if (normalized.length < 5) return false
  if (matchesAnyPattern(normalized, SUSPICIOUS_PROPERTY_TITLE_PATTERNS)) return false

  const alphaChars = normalized.replace(/[^a-z]/g, "")
  return alphaChars.length >= 4
}

export function getPublicCurationSnapshot(property: PublicCuratableProperty): PublicCurationSnapshot {
  const blockingReasons: PublicCurationReason[] = []
  const warningReasons: PublicCurationReason[] = []

  if (!isPresentablePublicTitle(property.title)) {
    blockingReasons.push(issue("weak_title", "Título fraco", "critical", "property-title"))
  }

  if (typeof property.price !== "number" || property.price <= 0) {
    blockingReasons.push(issue("missing_price", "Sem preço", "critical", "property-price"))
  }

  const gallerySources = [
    ...getArrayItems(property.images),
    ...getArrayItems(property.image_paths),
    ...(typeof property.thumbnail_url === "string" && property.thumbnail_url.trim()
      ? [property.thumbnail_url.trim()]
      : []),
    ...(typeof property.thumbnail_path === "string" && property.thumbnail_path.trim()
      ? [property.thumbnail_path.trim()]
      : []),
  ]

  if (gallerySources.length === 0) {
    blockingReasons.push(issue("missing_images", "Sem foto", "critical", "property-images"))
  } else {
    if (gallerySources.some((source) => isSuspiciousPublicMedia(source))) {
      blockingReasons.push(issue("suspicious_media", "Foto técnica", "critical", "property-images"))
    }

    if (gallerySources.length < 5) {
      warningReasons.push(issue("few_images", "Galeria fraca", "light", "property-images"))
    }
  }

  if (hasOwnProperty(property, "description")) {
    const description = normalizeText(property.description)
    if (!description) {
      blockingReasons.push(issue("missing_description", "Sem descrição", "critical", "property-description"))
    } else if (description.length < 80) {
      warningReasons.push(issue("weak_description", "Descrição curta", "light", "property-description"))
    }
  }

  const hiddenFromVitrine = property.hide_from_site === true
  const readyForVitrine = blockingReasons.length === 0
  const canPublishNow = readyForVitrine && hiddenFromVitrine
  const visibleOnPublicSite = readyForVitrine && !hiddenFromVitrine
  const displayReasons = [...blockingReasons, ...warningReasons].slice(0, 3)

  let reasonSummary = "Pronto para publicar"

  if (blockingReasons.length > 0) {
    reasonSummary = `Com pendências de publicação por ${blockingReasons
      .slice(0, 2)
      .map((reason) => reason.label.toLowerCase())
      .join(" e ")}`
  } else if (warningReasons.length > 0) {
    reasonSummary = `Pronto para publicar, mas vale revisar ${warningReasons
      .slice(0, 2)
      .map((reason) => reason.label.toLowerCase())
      .join(" e ")}`
  }

  if (hiddenFromVitrine && readyForVitrine) {
    reasonSummary = "Pronto para publicar, mas ainda oculto no site"
  } else if (hiddenFromVitrine && blockingReasons.length > 0) {
    reasonSummary = `Oculto no site e com ${blockingReasons
      .slice(0, 2)
      .map((reason) => reason.label.toLowerCase())
      .join(" e ")}`
  }

  return {
    blockingReasons,
    warningReasons,
    displayReasons,
    hiddenFromVitrine,
    readyForVitrine,
    canPublishNow,
    visibleOnPublicSite,
    reasonSummary,
  }
}

export function getPublicCurationPreview(snapshot: PublicCurationSnapshot, limit = 2) {
  return {
    visibleReasons: snapshot.displayReasons.slice(0, limit),
    hiddenCount: Math.max(snapshot.displayReasons.length - limit, 0),
  }
}

export function isCommerciallyAvailableForPublicSite(property: PublicCuratableProperty) {
  return typeof property.status === "string" && property.status.trim() === "available"
}

export function getPublicSiteReleaseReadiness(
  property: PublicCuratableProperty,
  snapshot = getPublicCurationSnapshot(property)
): PublicSiteReleaseReadiness {
  const commerciallyAvailable = isCommerciallyAvailableForPublicSite(property)

  return {
    commerciallyAvailable,
    readyToRelease: commerciallyAvailable && snapshot.canPublishNow,
    blockedByCuration: commerciallyAvailable && snapshot.blockingReasons.length > 0,
    liveOnPublicSite: commerciallyAvailable && snapshot.visibleOnPublicSite,
  }
}

function isPresentableBanner(banner: SitePublicBanner) {
  const text = normalizeText(`${banner.title ?? ""} ${banner.body ?? ""}`)
  if (text && matchesAnyPattern(text, SUSPICIOUS_BANNER_TEXT_PATTERNS)) {
    return false
  }

  const imageSource = `${banner.image_path ?? ""} ${banner.image_url ?? ""}`
  if (isSuspiciousPublicMedia(imageSource)) {
    return false
  }

  return true
}

export function pickCuratedBanner(
  banners: SitePublicBanner[] | null | undefined,
  placement: SiteBannerPlacement
) {
  return (banners ?? []).find((banner) => banner.placement === placement && isPresentableBanner(banner)) ?? null
}

export function filterCuratedPublicProperties(items: SitePropertyCard[] | null | undefined) {
  return (items ?? []).filter((item) => getPublicCurationSnapshot(item).visibleOnPublicSite)
}
