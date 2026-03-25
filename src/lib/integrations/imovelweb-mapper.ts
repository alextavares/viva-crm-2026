import { create, type XMLBuilder } from "xmlbuilder2"
import { CRMProperty } from "./zap-mapper"
import {
  buildImovelwebCharacteristics,
  resolveImovelwebPropertyType,
  type CharacteristicValue,
} from "./imovelweb-catalog"
import { getAddressLocalidadeName, resolveMappedLocalidadeId } from "./imovelweb-localidade"

export type ImovelwebFeedConfig = {
  codigoImobiliaria?: string
  emailUsuario?: string
  emailContato?: string
  nomeContato?: string
  telefoneContato?: string
  tipoPublicacao?: string
  mostrarMapa?: string | boolean
  defaultLocalidadeId?: string
  localidadeMappingsRaw?: string
}

function formatDataModification(value: Date): string {
  return String(value.getTime())
}

function normalizeZip(zip?: string | null): string | null {
  if (!zip) return null
  const digits = zip.replace(/\D/g, "")
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return digits || null
}

function normalizePhone(phone?: string | null): string {
  if (!phone) return ""
  return phone.replace(/[^\d+]/g, "").trim()
}

function resolveOperation(transactionType?: string | null): string {
  if (transactionType === "rent" || transactionType === "seasonal") {
    return "ALUGUEL"
  }
  return "VENTA"
}

function normalizePublicationType(value?: string | null): string {
  const normalized = value?.trim().toUpperCase()
  if (
    normalized === "SIMPLE" ||
    normalized === "DESTACADO" ||
    normalized === "HOME" ||
    normalized === "GRATIS" ||
    normalized === "ALQUILER_SIMPLE" ||
    normalized === "EXCLUSIVE" ||
    normalized === "EXCLUSIVE_II" ||
    normalized === "DESARROLLOS_HOME" ||
    normalized === "DESARROLLOS_DESTACADO" ||
    normalized === "DESARROLLOS_SIMPLE" ||
    normalized === "DESARROLLOS_GRATIS"
  ) {
    return normalized
  }
  return "SIMPLE"
}

function resolveMapVisibility(config?: ImovelwebFeedConfig, property?: CRMProperty): string {
  if (typeof config?.mostrarMapa === "string") {
    const normalized = config.mostrarMapa.trim().toUpperCase()
    if (normalized === "NO" || normalized === "APROXIMADO" || normalized === "EXACTO") {
      return normalized
    }
    if (normalized === "EXATO") {
      return "EXACTO"
    }
  }

  if (typeof config?.mostrarMapa === "boolean") {
    return config.mostrarMapa ? "EXACTO" : "NO"
  }
  const lat = property?.address?.lat
  const lng = property?.address?.lng
  return lat != null && lng != null ? "EXACTO" : "NO"
}

function resolveLocalidadeId(property: CRMProperty, config?: ImovelwebFeedConfig): string {
  const address = property.address ?? {}
  const mappedLocalidadeId = resolveMappedLocalidadeId(address, config?.localidadeMappingsRaw)
  if (mappedLocalidadeId) return mappedLocalidadeId

  return config?.defaultLocalidadeId?.trim() ?? ""
}

function resolveLocalidadeName(property: CRMProperty): string {
  return getAddressLocalidadeName(property.address)
}

function buildAddressLine(property: CRMProperty): string {
  const address = property.address ?? {}
  const street = typeof address.street === "string" ? address.street.trim() : ""
  const number = typeof address.number === "string" ? address.number.trim() : ""

  if (street && number) return `${street}, ${number}`
  if (address.full_address && typeof address.full_address === "string") return address.full_address.trim()
  return street
}

function buildCharacteristics(property: CRMProperty): CharacteristicValue[] {
  return buildImovelwebCharacteristics(property)
}

function appendCharacteristics(parent: XMLBuilder, property: CRMProperty) {
  const characteristics = buildCharacteristics(property)
  const node = parent.ele("caracteristicas")

  characteristics.forEach((item) => {
    const characteristic = node.ele("caracteristica")
    characteristic.ele("id").txt(item.id).up()
    characteristic.ele("nome").txt(item.nome).up()
    if (item.valor) characteristic.ele("valor").txt(item.valor).up()
    if (item.idValor) characteristic.ele("idValor").txt(item.idValor).up()
    characteristic.up()
  })

  node.up()
}

function appendImages(parent: XMLBuilder, property: CRMProperty) {
  const validImages = (property.images ?? []).filter((image): image is string => typeof image === "string" && image.trim().length > 0)
  if (!validImages.length) return

  const images = parent.ele("multimidia").ele("imagens")
  validImages.forEach((url) => {
    images.ele("imagem").ele("urlImagem").txt(url.trim()).up().up()
  })
  images.up().up()
}

function appendPublisher(parent: XMLBuilder, config?: ImovelwebFeedConfig) {
  const publisher = parent.ele("publicador")
  publisher.ele("codigoImobiliaria").txt(config?.codigoImobiliaria?.trim() ?? "").up()
  publisher.ele("emailUsuario").txt(config?.emailUsuario?.trim() ?? "").up()
  publisher.ele("emailContato").txt(config?.emailContato?.trim() ?? "").up()
  publisher.ele("nomeContato").txt(config?.nomeContato?.trim() ?? "").up()
  publisher.ele("telefoneContato").txt(normalizePhone(config?.telefoneContato)).up()
  publisher.up()
}

function appendLocation(parent: XMLBuilder, property: CRMProperty, config?: ImovelwebFeedConfig) {
  const address = property.address ?? {}
  const location = parent.ele("localizacao")
  const lat = address.lat
  const lng = address.lng
  const localidadeId = resolveLocalidadeId(property, config)
  const localidadeName = resolveLocalidadeName(property)

  location.ele("mostrarMapa").txt(resolveMapVisibility(config, property)).up()
  location.ele("endereco").txt(buildAddressLine(property)).up()
  location.ele("codigoPostal").txt(normalizeZip(address.zip) ?? "").up()
  location.ele("latitude").txt(typeof lat === "number" && Number.isFinite(lat) ? String(lat) : "").up()
  location.ele("longitude").txt(typeof lng === "number" && Number.isFinite(lng) ? String(lng) : "").up()
  if (localidadeName) {
    location.ele("localidade").txt(localidadeName).up()
  }
  if (localidadeId) {
    location.ele("idLocalidade").txt(localidadeId).up()
  }
  location.up()
}

export function generateImovelwebXml(properties: CRMProperty[], config?: ImovelwebFeedConfig): string {
  const publishedAt = new Date()
  const root = create({ version: "1.0", encoding: "UTF-8" }).ele("OpenNavent")
  root.ele("dataModificacao").dat(formatDataModification(publishedAt)).up()
  const listings = root.ele("Imoveis")

  properties.forEach((property) => {
    const listingId = property.public_code?.trim() || property.id
    const propertyType = resolveImovelwebPropertyType(property.type)
    const listing = listings.ele("Imovel")

    listing.ele("codigoAnuncio").txt(listingId).up()
    listing.ele("codigoReferencia").txt(listingId).up()

    const typeNode = listing.ele("tipoPropriedade")
    typeNode.ele("idTipo").txt(propertyType.idTipo).up()
    typeNode.ele("tipo").txt(propertyType.tipo).up()
    typeNode.ele("idSubTipo").txt(propertyType.idSubTipo).up()
    typeNode.ele("subTipo").txt(propertyType.subTipo).up()
    typeNode.up()

    appendCharacteristics(listing, property)

    if (property.title?.trim()) {
      listing.ele("titulo").txt(property.title.trim()).up()
    }

    const description = property.description?.trim() || "Sem descrição"
    listing.ele("descricao").dat(description).up()

    const prices = listing.ele("precos").ele("preco")
    prices.ele("quantidade").txt(property.price != null ? String(property.price) : "").up()
    prices.ele("moeda").txt("BRL").up()
    prices.ele("operacao").txt(resolveOperation(property.transaction_type)).up()
    prices.up().up()

    appendImages(listing, property)
    appendPublisher(listing, config)
    appendLocation(listing, property, config)

    const publication = listing.ele("publicacao")
    publication.ele("tipoPublicacao").dat(normalizePublicationType(config?.tipoPublicacao)).up()
    publication.up()

    listing.up()
  })

  listings.up()
  return root.end({ prettyPrint: true })
}
