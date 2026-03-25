import type { CRMProperty } from "./zap-mapper"

export type CharacteristicValue = {
  id: string
  nome: string
  valor?: string
  idValor?: string
}

export type PropertyTypeMapping = {
  idTipo: string
  tipo: string
  idSubTipo: string
  subTipo: string
}

type NumericCharacteristicDescriptor = {
  id: string
  nome: string
  aliases: string[]
}

type FlagCharacteristicDescriptor = {
  id: string
  nome: string
  aliases: string[]
}

export const IMOVELWEB_PROPERTY_TYPE_MAP: Record<string, PropertyTypeMapping> = {
  apartment: { idTipo: "2", tipo: "Apartamento", idSubTipo: "1", subTipo: "Padrão" },
  house: { idTipo: "1", tipo: "Casa", idSubTipo: "5", subTipo: "Padrão" },
  condominium_house: { idTipo: "1", tipo: "Casa", idSubTipo: "6", subTipo: "Casa de Condomínio" },
  land: { idTipo: "1003", tipo: "Terreno", idSubTipo: "8", subTipo: "Terreno Padrão" },
  // The CRM does not distinguish all commercial subtypes, so default to Loja/Salão.
  commercial: { idTipo: "1005", tipo: "Comercial", idSubTipo: "19", subTipo: "Loja/Salão" },
  commercial_space: { idTipo: "1005", tipo: "Comercial", idSubTipo: "19", subTipo: "Loja/Salão" },
}

export const SUPPORTED_IMOVELWEB_PROPERTY_TYPES = new Set(Object.keys(IMOVELWEB_PROPERTY_TYPE_MAP))

const NUMERIC_CHARACTERISTICS: NumericCharacteristicDescriptor[] = [
  { id: "CFT2", nome: "PRINCIPALES|QUARTO", aliases: ["bedrooms", "quartos"] },
  { id: "CFT3", nome: "PRINCIPALES|BANHEIRO", aliases: ["bathrooms", "banheiros"] },
  { id: "CFT4", nome: "PRINCIPALES|SUITE", aliases: ["suites", "suite"] },
  { id: "CFT7", nome: "PRINCIPALES|VAGA", aliases: ["garage", "garages", "parking_spaces", "vagas"] },
]

const FLAG_CHARACTERISTICS: FlagCharacteristicDescriptor[] = [
  { id: "20126", nome: "AREA_PRIVATIVA|MOBILIADO", aliases: ["furnished", "mobiliado"] },
  { id: "20017", nome: "AREA_PRIVATIVA|AREA_DE_SERVIÇO", aliases: ["service_area", "area_de_servico"] },
  { id: "20177", nome: "AREA_PRIVATIVA|SALA_DE_JANTAR", aliases: ["dining_room", "sala_de_jantar"] },
  { id: "20217", nome: "AREA_PRIVATIVA|TV", aliases: ["tv", "tv_room"] },
  { id: "20048", nome: "AREA_PRIVATIVA|CHURRASQUEIRA", aliases: ["barbecue", "bbq", "churrasqueira"] },
  { id: "20056", nome: "AREA_PRIVATIVA|COZINHA_AMERICANA", aliases: ["american_kitchen", "cozinha_americana"] },
  { id: "20057", nome: "AREA_PRIVATIVA|COZINHA_GOURMET", aliases: ["gourmet_kitchen", "cozinha_gourmet"] },
  { id: "10071", nome: "AREAS_COMUNS|ELEVADOR", aliases: ["elevator", "elevador"] },
  { id: "20080", nome: "AREA_PRIVATIVA|ESPAÇO_GOURMET", aliases: ["gourmet_space", "espaco_gourmet"] },
  { id: "20109", nome: "AREA_PRIVATIVA|INTERNET_WIRELESS", aliases: ["internet_wireless", "wifi"] },
  { id: "20117", nome: "AREA_PRIVATIVA|LAVANDERIA", aliases: ["laundry", "lavanderia"] },
  { id: "20135", nome: "AREA_PRIVATIVA|PERMITE_ANIMAIS", aliases: ["allows_pets", "permite_animais", "pet_friendly"] },
  { id: "20140", nome: "AREA_PRIVATIVA|PISCINA", aliases: ["private_pool", "piscina_privativa"] },
  { id: "10181", nome: "AREAS_COMUNS|SALÃO_DE_FESTAS", aliases: ["party_room", "salao_de_festas"] },
  { id: "20184", nome: "AREA_PRIVATIVA|SISTEMA_DE_ALARME", aliases: ["alarm_system", "sistema_alarme"] },
  { id: "10016", nome: "AREAS_COMUNS|AREA_DE_LAZER", aliases: ["area_de_lazer", "leisure_area"] },
  { id: "10090", nome: "AREAS_COMUNS|FITNESS/SALA_DE_GINASTICA", aliases: ["academia", "fitness", "gym"] },
  { id: "10028", nome: "AREAS_COMUNS|BRINQUEDOTECA", aliases: ["brinquedoteca", "kids_room"] },
  { id: "10048", nome: "AREAS_COMUNS|CHURRASQUEIRA", aliases: ["churrasqueira_comum", "common_barbecue"] },
  { id: "10030", nome: "AREAS_COMUNS|CÂMERAS_DE_SEGURANÇA", aliases: ["cameras_de_seguranca", "security_cameras"] },
  { id: "10140", nome: "AREAS_COMUNS|PISCINA", aliases: ["pool", "pool_common", "piscina", "piscina_comum"] },
  { id: "10152", nome: "AREAS_COMUNS|PLAYGROUND", aliases: ["playground"] },
  { id: "10182", nome: "AREAS_COMUNS|SALÃO_DE_JOGOS", aliases: ["game_room", "salao_de_jogos"] },
  { id: "10183", nome: "AREAS_COMUNS|SAUNA", aliases: ["sauna"] },
  { id: "10189", nome: "AREAS_COMUNS|SPA", aliases: ["spa"] },
]

function normalizeScalar(value: unknown): string {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  return ""
}

function getFeatureValue(features: CRMProperty["features"], aliases: string[]): unknown {
  if (!features) return null
  for (const alias of aliases) {
    if (alias in features) {
      return features[alias]
    }
  }
  return null
}

function getNumericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function getBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) && value > 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    return ["1", "true", "sim", "yes", "y"].includes(normalized)
  }
  return false
}

function addNumericCharacteristic(
  target: CharacteristicValue[],
  id: string,
  nome: string,
  value: unknown
) {
  const numericValue = getNumericValue(value)
  if (numericValue == null) return
  target.push({ id, nome, valor: String(numericValue) })
}

function addFlagCharacteristic(target: CharacteristicValue[], id: string, nome: string, value: unknown) {
  if (!getBooleanValue(value)) return
  target.push({ id, nome, idValor: "1" })
}

export function resolveImovelwebPropertyType(crmType: string | null | undefined): PropertyTypeMapping {
  return IMOVELWEB_PROPERTY_TYPE_MAP[crmType ?? ""] ?? IMOVELWEB_PROPERTY_TYPE_MAP.apartment
}

export function buildImovelwebCharacteristics(property: CRMProperty): CharacteristicValue[] {
  const features = property.features ?? {}
  const characteristics: CharacteristicValue[] = []

  for (const descriptor of NUMERIC_CHARACTERISTICS) {
    addNumericCharacteristic(characteristics, descriptor.id, descriptor.nome, getFeatureValue(features, descriptor.aliases))
  }

  const usefulArea =
    getNumericValue(getFeatureValue(features, ["area", "area_useful", "area_util", "usable_area", "living_area"])) ??
    null
  const totalArea =
    getNumericValue(getFeatureValue(features, ["total_area", "area_total", "built_area"])) ??
    usefulArea

  addNumericCharacteristic(characteristics, "CFT101", "MEDIDAS|AREA_UTIL", usefulArea)
  addNumericCharacteristic(characteristics, "CFT100", "MEDIDAS|AREA_TOTAL", totalArea)
  addNumericCharacteristic(characteristics, "CFT6", "PRINCIPALES|CONDOMINIO", property.condo_fee)
  addNumericCharacteristic(characteristics, "CFT400", "PRINCIPALES|IPTU", property.iptu)

  if (usefulArea != null || totalArea != null) {
    characteristics.push({ id: "CON1", nome: "MEDIDAS|UNIDAD_DE_MEDIDA", idValor: "M2" })
  }

  for (const descriptor of FLAG_CHARACTERISTICS) {
    addFlagCharacteristic(characteristics, descriptor.id, descriptor.nome, getFeatureValue(features, descriptor.aliases))
  }

  const deduped = new Map<string, CharacteristicValue>()
  for (const characteristic of characteristics) {
    deduped.set(characteristic.id, characteristic)
  }

  return [...deduped.values()]
}

export function getImovelwebFeatureDebugSnapshot(property: CRMProperty): Record<string, string> {
  const features = property.features ?? {}
  const snapshot: Record<string, string> = {}

  for (const descriptor of [...NUMERIC_CHARACTERISTICS, ...FLAG_CHARACTERISTICS]) {
    const value = getFeatureValue(features, descriptor.aliases)
    const normalized = normalizeScalar(value)
    if (normalized) snapshot[descriptor.id] = normalized
  }

  return snapshot
}
