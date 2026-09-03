import type { PropertyAddress, PropertyFeatures } from "@/lib/types"

export type UnivenRow = Record<string, string | null | undefined>

function safeText(v: unknown): string {
  if (typeof v !== "string") return ""
  return v.trim()
}

export function parseUnivenInt(v: unknown): number {
  const raw = safeText(v)
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

export function parseUnivenDecimal(v: unknown): number | null {
  const raw = safeText(v)
  if (!raw) return null
  // Keep only numeric separators; exports can use:
  // - "550000.0000" (dot as decimal separator)
  // - "9.500.000,00" (dot thousands + comma decimals)
  // Some exports also encode money as an integer with 4 implied decimals:
  // - "24000000000" meaning "2400000.0000" (divide by 10_000)
  let s = raw.replace(/[^\d.,-]/g, "")
  if (!s) return null

  const hasComma = s.includes(",")
  const hasDot = s.includes(".")

  if (s.includes(",")) {
    // pt-BR style: remove thousands separators and convert decimal comma to dot
    s = s.replace(/\./g, "").replace(",", ".")
  } else {
    // No comma. If it looks like "1.234.567" treat dots as thousands separators.
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "")
    }
    // Otherwise keep the dot as decimal separator (e.g. "550000.0000").
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null

  // Heuristic: if the raw has no separators, is very large, and ends with 4 zeros,
  // treat it as "implied 4 decimals" and scale down.
  // This avoids inflating prices like 2.400.000,00 into 24.000.000.000.
  if (!hasComma && !hasDot) {
    const abs = Math.abs(n)
    if (abs >= 100_000_000 && abs % 10_000 === 0) {
      return n / 10_000
    }
  }

  return n
}

export function buildUnivenExternalId(fkempresa: unknown, pkimovel: unknown): string | null {
  const emp = parseUnivenInt(fkempresa)
  const id = parseUnivenInt(pkimovel)
  if (!emp || !id) return null
  return `univen:${emp}:${id}`
}

export function mapUnivenType(rawType: unknown): "apartment" | "house" | "land" | "commercial" {
  const t = safeText(rawType).toUpperCase()
  if (t.includes("APART")) return "apartment"
  if (t.includes("CASA") || t.includes("SITIO") || t.includes("CHACARA")) return "house"
  if (t.includes("TERRENO") || t.includes("LOTE")) return "land"
  if (t.includes("SALAO") || t.includes("PONTO") || t.includes("COMERCIAL") || t.includes("LOJA")) return "commercial"
  return "house"
}

export function mapUnivenStatus(raw: unknown): "available" | "sold" | "rented" {
  const s = safeText(raw).toUpperCase()
  if (s.includes("VEND")) return "sold"
  if (s.includes("LOC")) return "rented"
  return "available"
}

export function mapUnivenTransactionType(
  venda: unknown,
  locacao: unknown,
  temporada: unknown
): "sale" | "rent" | "seasonal" {
  if (parseUnivenInt(temporada) > 0) return "seasonal"
  if (parseUnivenInt(venda) > 0) return "sale"
  if (parseUnivenInt(locacao) > 0) return "rent"
  return "sale"
}

export function mapUnivenPurpose(rawType: unknown, rawSubtype: unknown): "residential" | "commercial" {
  const haystack = `${safeText(rawType)} ${safeText(rawSubtype)}`.toUpperCase()
  if (
    haystack.includes("COMERCIAL") ||
    haystack.includes("PONTO") ||
    haystack.includes("LOJA") ||
    haystack.includes("SALAO") ||
    haystack.includes("GALPAO")
  ) {
    return "commercial"
  }

  return "residential"
}

export function buildUnivenAddress(row: UnivenRow): PropertyAddress {
  const street = safeText(row.principalendereco) || null
  const number = safeText(row.principalnumero) || null
  const neighborhood = safeText(row.principalbairro) || null
  const city = safeText(row.principalcidade) || null
  const state = safeText(row.principaluf) || null
  const zip = safeText(row.principalcep) || null

  const streetLine = [street, number].filter(Boolean).join(", ")
  const locality = [neighborhood, city, state].filter(Boolean).join(" - ")
  const zipLine = zip ? `CEP ${zip}` : ""

  const full_address = [streetLine, locality, zipLine].filter(Boolean).join(" | ").trim() || null

  return {
    full_address,
    street,
    number,
    neighborhood,
    city,
    state,
    zip,
    country: "Brasil",
  }
}

function firstFilled(row: UnivenRow, keys: string[]): string | null {
  for (const key of keys) {
    const value = safeText(row[key])
    if (value) return value
  }

  return null
}

export type UnivenPropertyPayload = {
  external_id: string
  title: string
  description: string | null
  price: number
  type: "apartment" | "house" | "land" | "commercial"
  status: "available" | "sold" | "rented"
  transaction_type: "sale" | "rent" | "seasonal"
  purpose: "residential" | "commercial"
  built_area: number | null
  total_area: number | null
  financing_allowed: boolean
  owner_name: string | null
  assigned_to_hint: string | null
  features: PropertyFeatures
  address: PropertyAddress
  images: string[]
}

export function mapUnivenRowToProperty(row: UnivenRow, imageUrls: string[]): UnivenPropertyPayload | null {
  const external_id = buildUnivenExternalId(row.fkempresa, row.pkimovel)
  if (!external_id) return null

  const title =
    safeText(row.internettitle) ||
    safeText(row.referencia_imovel) ||
    `Imóvel ${safeText(row.pkimovel) || "sem referência"}`

  const description =
    safeText(row.internetanunciointernet) ||
    safeText(row.internetmetadescription) ||
    ""

  const transaction_type = mapUnivenTransactionType(
    row.principalvenda,
    row.principallocalacao,
    row.principaltemporada
  )

  const promo = parseUnivenDecimal(row.principalvalvendapromo)
  const sale = parseUnivenDecimal(row.principalvalvenda)
  const rent = parseUnivenDecimal(row.principalvallocalacao) ?? parseUnivenDecimal(row.principalvallocalacaoestu)
  const seasonal = parseUnivenDecimal(row.principalvaltemporada)
  const price =
    transaction_type === "rent"
      ? rent ?? 0
      : transaction_type === "seasonal"
        ? seasonal ?? 0
        : (promo && promo > 0 ? promo : sale) ?? 0

  const type = mapUnivenType(row.principaltipo)
  const purpose = mapUnivenPurpose(row.principaltipo, row.principalsubtipo)
  const status = mapUnivenStatus(row.principalsituacao)
  const financing_allowed = parseUnivenInt(row.principalaceitaf) > 0 || parseUnivenInt(row.principalfinanciado) > 0
  const owner_name = firstFilled(row, [
    "proprietarionome",
    "proprietario",
    "principalproprietario",
    "principalproprietarionome",
    "contatoproprietario",
  ])
  const assigned_to_hint = firstFilled(row, [
    "captacaocorretor",
    "captacaocaptador",
    "corretornome",
    "captadornome",
  ])

  const bedrooms = parseUnivenInt(row.detalhedormitorios)
  const bathrooms = parseUnivenInt(row.detalhebanheiros)
  const garages = parseUnivenInt(row.detalhegaragens)
  const suites = parseUnivenInt(row.detalhesuite)
  const built_area =
    parseUnivenDecimal(row.detalheareautil) ??
    parseUnivenDecimal(row.detalheareaconst) ??
    null
  const total_area =
    parseUnivenDecimal(row.detalheareatotal) ??
    parseUnivenDecimal(row.detalheareaterreno) ??
    null
  const area = built_area ?? total_area ?? 0

  const features: PropertyFeatures = {
    bedrooms,
    bathrooms,
    area: Number(area) || 0,
    garages,
    suites,
    // Keep source hints to help support and future enrichments.
    source: "univen",
    source_type: safeText(row.principaltipo) || null,
    source_status: safeText(row.principalsituacao) || null,
  }

  const address = buildUnivenAddress(row)

  const images = (imageUrls || []).filter(Boolean)

  return {
    external_id,
    title,
    description: description ? description : null,
    price,
    type,
    status,
    transaction_type,
    purpose,
    built_area,
    total_area,
    financing_allowed,
    owner_name,
    assigned_to_hint,
    features,
    address,
    images,
  }
}
