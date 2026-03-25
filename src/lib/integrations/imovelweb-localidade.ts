type AddressWithLocalidade = {
  city?: string | null
  state?: string | null
  neighborhood?: string | null
  [key: string]: unknown
} | null | undefined

export type ParsedLocalidadeMappings = {
  map: Record<string, string>
  invalidLines: string[]
}

function normalizeChunk(value?: string | null): string {
  if (!value) return ""
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
}

export function buildLocalidadeLookupKey(
  city?: string | null,
  state?: string | null,
  neighborhood?: string | null
): string {
  const normalizedCity = normalizeChunk(city)
  const normalizedState = normalizeChunk(state).toUpperCase()
  if (!normalizedCity || !normalizedState) return ""

  const normalizedNeighborhood = normalizeChunk(neighborhood)
  if (normalizedNeighborhood) {
    return `${normalizedState}|${normalizedCity}|${normalizedNeighborhood}`
  }

  return `${normalizedState}|${normalizedCity}`
}

export function parseLocalidadeMappings(raw: unknown): ParsedLocalidadeMappings {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { map: {}, invalidLines: [] }
  }

  const parsed: Record<string, string> = {}
  const invalidLines: string[] = []
  const lines = raw.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const separatorIndex = trimmed.indexOf("=")
    if (separatorIndex <= 0) {
      invalidLines.push(trimmed)
      continue
    }

    const left = trimmed.slice(0, separatorIndex).trim()
    const right = trimmed.slice(separatorIndex + 1).trim()
    const parts = left
      .split("|")
      .map((value) => value.trim())
      .filter(Boolean)

    if (parts.length < 2 || parts.length > 3 || !right) {
      invalidLines.push(trimmed)
      continue
    }

    const [state, city, neighborhood] = parts
    const key = buildLocalidadeLookupKey(city, state, neighborhood)
    if (!key) {
      invalidLines.push(trimmed)
      continue
    }

    parsed[key] = right
  }

  return { map: parsed, invalidLines }
}

export function getAddressLocalidadeId(address: AddressWithLocalidade): string {
  if (!address) return ""
  const raw =
    address.idLocalidade ??
    address.id_localidade ??
    address.localidadeId ??
    address.localityId ??
    address.locality_id

  return typeof raw === "string" ? raw.trim() : ""
}

export function getAddressLocalidadeName(address: AddressWithLocalidade): string {
  if (!address) return ""

  const raw =
    address.localidade ??
    address.localidadeNome ??
    address.localidade_nome ??
    address.locality ??
    address.locality_name ??
    address.localityName

  return typeof raw === "string" ? raw.trim() : ""
}

export function resolveMappedLocalidadeId(address: AddressWithLocalidade, mappingsRaw: unknown): string {
  const explicit = getAddressLocalidadeId(address)
  if (explicit) return explicit
  if (!address) return ""

  const { map } = parseLocalidadeMappings(mappingsRaw)
  const city = typeof address.city === "string" ? address.city : ""
  const state = typeof address.state === "string" ? address.state : ""
  const neighborhood = typeof address.neighborhood === "string" ? address.neighborhood : ""
  const neighborhoodKey = buildLocalidadeLookupKey(city, state, neighborhood)
  const cityKey = buildLocalidadeLookupKey(city, state)

  if (neighborhoodKey && map[neighborhoodKey]) return map[neighborhoodKey]
  if (cityKey && map[cityKey]) return map[cityKey]
  return ""
}
