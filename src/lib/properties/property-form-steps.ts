import type { PropertyOperationalFocusFieldId } from "@/lib/property-operational-readiness"

export type PropertyFormStepId =
  | "essentials"
  | "owner"
  | "commercial"
  | "location"
  | "media"
  | "publication"

export type PropertyFormStep = {
  id: PropertyFormStepId
  label: string
  shortLabel: string
  description: string
}

export const PROPERTY_FORM_STEPS: PropertyFormStep[] = [
  {
    id: "essentials",
    label: "Essenciais",
    shortLabel: "Essenciais",
    description: "Título, tipo, preço, responsável e dados básicos.",
  },
  {
    id: "owner",
    label: "Proprietário",
    shortLabel: "Proprietário",
    description: "Selecione ou crie o proprietário principal do imóvel.",
  },
  {
    id: "commercial",
    label: "Comercial",
    shortLabel: "Comercial",
    description: "Descrição, posicionamento e qualidade comercial do anúncio.",
  },
  {
    id: "location",
    label: "Localização",
    shortLabel: "Localização",
    description: "Endereço estruturado para melhorar vitrine e portais.",
  },
  {
    id: "media",
    label: "Fotos",
    shortLabel: "Fotos",
    description: "Galeria, capa e qualidade mínima das imagens.",
  },
  {
    id: "publication",
    label: "Publicação",
    shortLabel: "Publicação",
    description: "Status, vitrine pública e distribuição para portais.",
  },
]

type PropertyFormStepFieldId =
  | PropertyOperationalFocusFieldId
  | "property-owner"
  | "property-site-visibility"
  | "property-portals"

const FIELD_TO_STEP: Record<PropertyFormStepFieldId, PropertyFormStepId> = {
  "property-title": "essentials",
  "property-type": "essentials",
  "property-transaction-type": "essentials",
  "property-price": "essentials",
  "property-area": "essentials",
  "property-bedrooms": "essentials",
  "property-bathrooms": "essentials",
  "property-responsible": "essentials",
  "property-owner": "owner",
  "property-description": "commercial",
  address_city: "location",
  address_neighborhood: "location",
  "property-images": "media",
  "property-site-visibility": "publication",
  "property-portals": "publication",
}

const GROUP_TO_STEP: Record<string, PropertyFormStepId> = {
  essentials: "essentials",
  responsibility: "essentials",
  owner: "owner",
  commercial: "commercial",
  location: "location",
  media: "media",
  publication: "publication",
}

export type PropertyStepIssueLike = {
  group?: string | null
  focusFieldId?: string | null
  severity?: string
  code?: string
  label?: string
}

export type PropertyFormStepIssueCounts = Record<PropertyFormStepId, number>

export type PropertyPortalPublicationValues = {
  publish_to_portals: boolean
  publish_imovelweb: boolean
  publish_zap: boolean
  publish_olx: boolean
}

export function createEmptyPropertyFormStepIssueCounts(): PropertyFormStepIssueCounts {
  return {
    essentials: 0,
    owner: 0,
    commercial: 0,
    location: 0,
    media: 0,
    publication: 0,
  }
}

export function getPropertyFormStepForField(fieldId?: string | null): PropertyFormStepId {
  if (!fieldId) return "essentials"
  return FIELD_TO_STEP[fieldId as PropertyFormStepFieldId] ?? "essentials"
}

export function countPropertyIssuesByStep(
  issues: PropertyStepIssueLike[]
): PropertyFormStepIssueCounts {
  return issues.reduce((counts, issue) => {
    const targetStep =
      typeof issue.focusFieldId === "string" && issue.focusFieldId.length > 0
        ? getPropertyFormStepForField(issue.focusFieldId)
        : issue.group
          ? GROUP_TO_STEP[issue.group] ?? "essentials"
          : "essentials"
    counts[targetStep] += 1
    return counts
  }, createEmptyPropertyFormStepIssueCounts())
}

export function getNextPortalPublicationValues(enabled: boolean): PropertyPortalPublicationValues {
  return {
    publish_to_portals: enabled,
    publish_imovelweb: enabled,
    publish_zap: enabled,
    publish_olx: enabled,
  }
}
