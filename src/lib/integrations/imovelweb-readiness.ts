import { getAddressLocalidadeName, parseLocalidadeMappings, resolveMappedLocalidadeId } from "./imovelweb-localidade"
import { SUPPORTED_IMOVELWEB_PROPERTY_TYPES } from "./imovelweb-catalog"

type IntegrationConfig = Record<string, unknown>

type PropertyForImovelwebReadiness = {
  id: string
  title: string | null
  description: string | null
  price: number | null
  type: string | null
  status: string | null
  images: string[] | null
  image_paths: string[] | null
  address:
    | {
        city?: string | null
        state?: string | null
        zip?: string | null
        street?: string | null
        full_address?: string | null
        neighborhood?: string | null
        lat?: number | null
        lng?: number | null
        [key: string]: unknown
      }
    | null
  hide_from_site: boolean | null
}

export type ImovelwebReadinessIssue = {
  propertyId: string | null
  severity: "blocker" | "warning"
  issueKey: string
  messageHuman: string
}

function hasAnyImage(images: string[] | null, imagePaths: string[] | null): boolean {
  const fromUrls = Array.isArray(images) && images.some((value) => typeof value === "string" && value.trim().length > 0)
  const fromPaths = Array.isArray(imagePaths) && imagePaths.some((value) => typeof value === "string" && value.trim().length > 0)
  return fromUrls || fromPaths
}

function getAddressLine(address: PropertyForImovelwebReadiness["address"]): string {
  if (!address) return ""
  const fullAddress = typeof address.full_address === "string" ? address.full_address.trim() : ""
  const street = typeof address.street === "string" ? address.street.trim() : ""
  return fullAddress || street
}

function hasCoordinates(address: PropertyForImovelwebReadiness["address"]): boolean {
  if (!address) return false
  return typeof address.lat === "number" && Number.isFinite(address.lat) && typeof address.lng === "number" && Number.isFinite(address.lng)
}

export function getImovelwebReadinessIssues(
  properties: PropertyForImovelwebReadiness[],
  config: IntegrationConfig,
  options?: {
    sendOnlyAvailable?: boolean
    sendOnlyWithPhotos?: boolean
  }
): ImovelwebReadinessIssue[] {
  const issues: ImovelwebReadinessIssue[] = []
  const sendOnlyAvailable = Boolean(options?.sendOnlyAvailable ?? true)
  const sendOnlyWithPhotos = Boolean(options?.sendOnlyWithPhotos ?? true)
  const codigoImobiliaria = typeof config.codigo_imobiliaria === "string" ? config.codigo_imobiliaria.trim() : ""
  const defaultLocalidadeId = typeof config.default_localidade_id === "string" ? config.default_localidade_id.trim() : ""
  const localidadeMappingsRaw = config.localidade_mappings_raw
  const { invalidLines } = parseLocalidadeMappings(localidadeMappingsRaw)

  if (!codigoImobiliaria) {
    issues.push({
      propertyId: null,
      severity: "blocker",
      issueKey: "missing_codigo_imobiliaria",
      messageHuman: "A integração Imovelweb está sem o código da imobiliária. O XML oficial OpenNavent exige esse campo.",
    })
  }

  if (!defaultLocalidadeId) {
    issues.push({
      propertyId: null,
      severity: "warning",
      issueKey: "missing_default_localidade",
      messageHuman: "A integração está sem ID de localidade padrão. Imóveis sem idLocalidade ou localidade explícita podem ser rejeitados pelo portal.",
    })
  }

  if (invalidLines.length > 0) {
    issues.push({
      propertyId: null,
      severity: "warning",
      issueKey: "invalid_localidade_mapping_lines",
      messageHuman: `Existem ${invalidLines.length} linha(s) inválida(s) no mapa de localidade da integração Imovelweb.`,
    })
  }

  const hiddenCount = properties.filter((property) => property.hide_from_site === true).length
  const visibleProperties = properties.filter((property) => property.hide_from_site !== true)

  if (visibleProperties.length === 0 && hiddenCount > 0) {
    issues.push({
      propertyId: null,
      severity: "warning",
      issueKey: "all_hidden",
      messageHuman: "Nenhum imóvel entra no feed porque todos estão como “Oculto do site”.",
    })
  }

  for (const property of visibleProperties) {
    const title = typeof property.title === "string" ? property.title.trim() : ""
    const description = typeof property.description === "string" ? property.description.trim() : ""
    const type = typeof property.type === "string" ? property.type.trim() : ""
    const city = typeof property.address?.city === "string" ? property.address.city.trim() : ""
    const state = typeof property.address?.state === "string" ? property.address.state.trim() : ""
    const zip = typeof property.address?.zip === "string" ? property.address.zip.trim() : ""
    const localidadeId = resolveMappedLocalidadeId(property.address, localidadeMappingsRaw)
    const localidadeName = getAddressLocalidadeName(property.address)
    const propertyAddress = getAddressLine(property.address)
    const photosCount = hasAnyImage(property.images, property.image_paths)
    const propertyLabel = title || "Sem título"

    const add = (severity: "blocker" | "warning", issueKey: string, messageHuman: string) => {
      issues.push({
        propertyId: property.id,
        severity,
        issueKey,
        messageHuman,
      })
    }

    if (sendOnlyAvailable && property.status !== "available") {
      add("warning", "excluded_status", `O imóvel '${propertyLabel}' não entra no feed porque está com status '${property.status ?? "desconhecido"}'.`)
    }

    if (sendOnlyWithPhotos && !photosCount) {
      add("blocker", "missing_photos", `O imóvel '${propertyLabel}' não pode ser publicado porque não tem fotos.`)
    }

    if (typeof property.price !== "number" || !Number.isFinite(property.price) || property.price <= 0) {
      add("blocker", "missing_price", `O imóvel '${propertyLabel}' não pode ser publicado porque falta o preço.`)
    }

    if (!type) {
      add("blocker", "missing_type", `O imóvel '${propertyLabel}' não pode ser publicado porque falta o tipo do imóvel.`)
    } else if (!SUPPORTED_IMOVELWEB_PROPERTY_TYPES.has(type)) {
      add("blocker", "unsupported_type", `O imóvel '${propertyLabel}' usa o tipo '${type}', que ainda não está mapeado no schema OpenNavent.`)
    }

    if (!title || title.length < 5) {
      add("blocker", "short_title", `O imóvel '${propertyLabel}' não pode ser publicado porque o título é muito curto.`)
    }

    if (!description) {
      add("warning", "missing_description", `O imóvel '${propertyLabel}' está sem descrição.`)
    } else if (description.length < 80) {
      add("warning", "short_description", `O imóvel '${propertyLabel}' está com descrição curta para o portal.`)
    }

    if (!city || !state) {
      add("blocker", "missing_city_state", `O imóvel '${propertyLabel}' não pode ser publicado porque falta Cidade e/ou UF no endereço.`)
    }

    if (!propertyAddress) {
      add("blocker", "missing_address", `O imóvel '${propertyLabel}' não pode ser publicado porque falta o endereço.`)
    }

    if (!localidadeId && !defaultLocalidadeId && !localidadeName) {
      add("blocker", "missing_localidade", `O imóvel '${propertyLabel}' não pode ser publicado porque está sem idLocalidade/localidade e a integração também não tem localidade padrão.`)
    } else if (!localidadeId && !localidadeName && defaultLocalidadeId) {
      add("warning", "using_default_localidade", `O imóvel '${propertyLabel}' está usando a localidade padrão da integração. Idealmente ele deveria ter um idLocalidade próprio ou mapeado por cidade.`)
    } else if (!localidadeId && localidadeName) {
      add("warning", "using_localidade_name", `O imóvel '${propertyLabel}' está usando apenas o campo localidade. Se possível, prefira enviar idLocalidade.`)
    }

    if (!zip) {
      add("warning", "missing_zip", `O imóvel '${propertyLabel}' está sem CEP. Isso pode reduzir a qualidade do anúncio.`)
    }

    if (!hasCoordinates(property.address)) {
      add("warning", "missing_coordinates", `O imóvel '${propertyLabel}' está sem latitude/longitude. O mapa pode não ser exibido corretamente.`)
    }
  }

  return issues
}
