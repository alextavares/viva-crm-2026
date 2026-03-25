import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

type JsonRecord = Record<string, unknown>

type CatalogOutput = {
  fetchedAt: string
  baseUrl: string
  typeIds: string[]
  authMode: string
  endpoints: {
    login?: string
    propertyTypes: string
    subtypes: string[]
    characteristics: string[]
    publicationAreas?: string
    mapVisibility?: string
    locations?: string
  }
  propertyTypes: unknown
  subtypesByType: Record<string, unknown>
  characteristicsByType: Record<string, unknown>
  publicationAreas?: unknown
  mapVisibility?: unknown
  locations?: unknown
}

function getEnv(name: string): string {
  const value = process.env[name]?.trim()
  return value ?? ""
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "")
}

function buildHeaders(token?: string): HeadersInit {
  const authHeader = getEnv("OPENNAVENT_AUTH_HEADER")
  if (authHeader) {
    return {
      Accept: "application/json",
      Authorization: authHeader,
    }
  }

  const bearerToken = token || getEnv("OPENNAVENT_API_TOKEN") || getEnv("OPENNAVENT_BEARER_TOKEN")
  if (bearerToken) {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${bearerToken}`,
    }
  }

  const username = getEnv("OPENNAVENT_USERNAME")
  const password = getEnv("OPENNAVENT_PASSWORD")
  if (username && password) {
    const encoded = Buffer.from(`${username}:${password}`).toString("base64")
    return {
      Accept: "application/json",
      Authorization: `Basic ${encoded}`,
    }
  }

  return {
    Accept: "application/json",
  }
}

function resolveRequestedTypeIds(): string[] {
  const cliTypes = process.argv
    .slice(2)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean)

  if (cliTypes.length > 0) return cliTypes

  const envTypes = getEnv("OPENNAVENT_TYPE_IDS")
  if (!envTypes) return []

  return envTypes
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function unwrapCollection(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload
  }

  const record = payload as JsonRecord
  for (const key of ["data", "items", "results", "tipopropriedades", "tipopropiedades", "subtipos", "caracteristicas", "locais"]) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }

  return payload
}

async function fetchJson(
  baseUrl: string,
  endpoint: string,
  headers: HeadersInit,
  init?: Omit<RequestInit, "headers">
): Promise<unknown> {
  const url = `${baseUrl}${endpoint}`
  const response = await fetch(url, { ...init, headers })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Request failed for ${endpoint}: ${response.status} ${response.statusText}\n${body}`)
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    const body = await response.text()
    throw new Error(`Expected JSON from ${endpoint}, received '${contentType}'.\n${body}`)
  }

  return response.json()
}

function extractTypeIds(payload: unknown): string[] {
  const unwrapped = unwrapCollection(payload)
  if (!Array.isArray(unwrapped)) return []

  return unwrapped
    .map((item) => {
      if (!item || typeof item !== "object") return ""
      const record = item as JsonRecord
      const raw = record.id ?? record.idTipo ?? record.idtipopropriedade ?? record.idTipoPropriedade
      return typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : ""
    })
    .filter(Boolean)
}

async function authenticateIfNeeded(baseUrl: string): Promise<{ token?: string; authMode: string; loginEndpoint?: string }> {
  const explicitAuthHeader = getEnv("OPENNAVENT_AUTH_HEADER")
  if (explicitAuthHeader) {
    return { authMode: "authorization_header" }
  }

  const explicitBearer = getEnv("OPENNAVENT_API_TOKEN") || getEnv("OPENNAVENT_BEARER_TOKEN")
  if (explicitBearer) {
    return { token: explicitBearer, authMode: "bearer_token" }
  }

  const username = getEnv("OPENNAVENT_USERNAME")
  const password = getEnv("OPENNAVENT_PASSWORD")
  if (!username || !password) {
    return { authMode: "anonymous" }
  }

  const loginEndpoint = `/v1/application/login?grant_type=client_credentials&client_id=${encodeURIComponent(username)}&client_secret=${encodeURIComponent(password)}`
  const redactedLoginEndpoint = "/v1/application/login?grant_type=client_credentials&client_id=[redacted]&client_secret=[redacted]"
  const payload = await fetchJson(
    baseUrl,
    loginEndpoint,
    {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    { method: "POST" }
  )

  if (!payload || typeof payload !== "object") {
    throw new Error("Authentication response did not return a JSON object.")
  }

  const accessToken = (payload as JsonRecord).access_token
  if (typeof accessToken !== "string" || accessToken.trim().length === 0) {
    throw new Error(`Authentication succeeded but no access_token was returned.\n${JSON.stringify(payload, null, 2)}`)
  }

  return {
    token: accessToken,
    authMode: "client_credentials",
    loginEndpoint: redactedLoginEndpoint,
  }
}

async function fetchFirstAvailable(baseUrl: string, endpoints: string[], headers: HeadersInit): Promise<{ endpoint: string; payload: unknown }> {
  const errors: string[] = []

  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson(baseUrl, endpoint, headers)
      return { endpoint, payload }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${endpoint}: ${message}`)
    }
  }

  throw new Error(errors.join("\n\n"))
}

async function main() {
  const rawBaseUrl =
    getEnv("OPENNAVENT_API_BASE_URL") ||
    getEnv("OPEN_CLASSIFIEDS_API_BASE_URL") ||
    getEnv("OPENNAVENT_BASE_URL")

  if (!rawBaseUrl) {
    throw new Error(
      [
        "Missing OpenNavent base URL.",
        "Set one of these in .env.local:",
        "- OPENNAVENT_API_BASE_URL",
        "- OPEN_CLASSIFIEDS_API_BASE_URL",
        "- OPENNAVENT_BASE_URL",
      ].join("\n")
    )
  }

  const baseUrl = normalizeBaseUrl(rawBaseUrl)
  const auth = await authenticateIfNeeded(baseUrl)
  const headers = buildHeaders(auth.token)
  const requestedTypeIds = resolveRequestedTypeIds()

  console.log(`Fetching OpenNavent catalog from ${baseUrl}`)
  console.log(`Authentication mode: ${auth.authMode}`)
  if (requestedTypeIds.length > 0) {
    console.log(`Filtering detailed fetch to type IDs: ${requestedTypeIds.join(", ")}`)
  }

  const propertyTypesResult = await fetchFirstAvailable(
    baseUrl,
    ["/v1/tipopropriedade", "/v1/tipopropiedades"],
    headers
  )
  const propertyTypesEndpoint = propertyTypesResult.endpoint
  const propertyTypesPayload = propertyTypesResult.payload
  const propertyTypes = unwrapCollection(propertyTypesPayload)
  const effectiveTypeIds = requestedTypeIds.length > 0 ? requestedTypeIds : extractTypeIds(propertyTypesPayload)

  if (effectiveTypeIds.length > 0) {
    console.log(`Fetching detailed catalogs for type IDs: ${effectiveTypeIds.join(", ")}`)
  } else {
    console.log("No type IDs discovered from the property-types endpoint. Detailed fetch will be skipped.")
  }

  const subtypesByType: Record<string, unknown> = {}
  const characteristicsByType: Record<string, unknown> = {}
  let publicationAreas: unknown
  let mapVisibility: unknown
  let locations: unknown

  for (const typeId of effectiveTypeIds) {
    const subtypesResult = await fetchFirstAvailable(
      baseUrl,
      [`/v1/tipopropriedade/${typeId}/subtipos`, `/v1/tipopropiedades/${typeId}/subtipos`],
      headers
    )
    const characteristicsResult = await fetchFirstAvailable(
      baseUrl,
      [`/v1/tipopropriedade/${typeId}/caracteristicas`, `/v1/tipopropiedades/${typeId}/caracteristicas`],
      headers
    )

    console.log(`Fetching subtypes for type ${typeId}`)
    subtypesByType[typeId] = unwrapCollection(subtypesResult.payload)

    console.log(`Fetching characteristics for type ${typeId}`)
    characteristicsByType[typeId] = unwrapCollection(characteristicsResult.payload)
  }

  try {
    publicationAreas = unwrapCollection(
      (
        await fetchFirstAvailable(baseUrl, ["/v1/publicacao/areas", "/v1/publicacion/planes"], headers)
      ).payload
    )
  } catch {
    publicationAreas = undefined
  }

  try {
    mapVisibility = unwrapCollection(
      (
        await fetchFirstAvailable(baseUrl, ["/v1/mapa/visibilidade", "/v1/mapa/visibilidad"], headers)
      ).payload
    )
  } catch {
    mapVisibility = undefined
  }

  try {
    locations = unwrapCollection(
      (
        await fetchFirstAvailable(baseUrl, ["/v1/locais", "/v1/ubicaciones"], headers)
      ).payload
    )
  } catch {
    locations = undefined
  }

  const output: CatalogOutput = {
    fetchedAt: new Date().toISOString(),
    baseUrl,
    typeIds: effectiveTypeIds,
    authMode: auth.authMode,
    endpoints: {
      login: auth.loginEndpoint,
      propertyTypes: propertyTypesEndpoint,
      subtypes: effectiveTypeIds.map((id) => `/v1/tipopropriedade/${id}/subtipos`),
      characteristics: effectiveTypeIds.map((id) => `/v1/tipopropriedade/${id}/caracteristicas`),
      publicationAreas: "/v1/publicacao/areas",
      mapVisibility: "/v1/mapa/visibilidade",
      locations: "/v1/locais",
    },
    propertyTypes,
    subtypesByType,
    characteristicsByType,
    publicationAreas,
    mapVisibility,
    locations,
  }

  const outputDir = path.resolve(process.cwd(), "tmp")
  const outputPath = path.join(outputDir, "open-navent-catalog.json")
  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8")

  console.log(`Catalog saved to ${outputPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
