type QualificationSnapshot = {
  intent?: string | null
  transaction_type?: string | null
  property_type?: string | null
  city?: string | null
  neighborhoods?: string[] | null
  budget_min?: number | null
  budget_max?: number | null
  timeline?: string | null
  stage_score?: number | null
  summary?: string | null
}

export const AI_LEAD_STEPS = ["intent", "property_type", "location", "budget", "timeline"] as const
export type AiLeadStep = (typeof AI_LEAD_STEPS)[number]

const PROPERTY_TYPE_KEYWORDS: Array<{ value: string; terms: string[] }> = [
  { value: "apartment", terms: ["apartamento", "apto", "flat", "studio"] },
  { value: "house", terms: ["casa", "sobrado"] },
  { value: "condominium_house", terms: ["condominio", "condomínio"] },
  { value: "land", terms: ["terreno", "lote"] },
  { value: "commercial", terms: ["comercial", "loja", "galpao", "galpão", "sala comercial"] },
]

export function normalizeAiText(value: string | null | undefined, maxLen = 500) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

function normalizeBudgetChunk(raw: string) {
  const compact = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")
  const parsed = Number(compact)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.round(parsed * 100) / 100
}

export function extractBudgetRange(message: string) {
  const matches = message.match(/[\d.,]+/g) ?? []
  const values = matches
    .map((chunk) => normalizeBudgetChunk(chunk))
    .filter((value): value is number => typeof value === "number")

  if (values.length === 0) return { budget_min: null, budget_max: null }
  if (values.length === 1) return { budget_min: null, budget_max: values[0] }

  const sorted = [...values].sort((a, b) => a - b)
  return { budget_min: sorted[0], budget_max: sorted[sorted.length - 1] }
}

export function extractIntent(message: string) {
  const normalized = message.toLowerCase()
  if (/(comprar|compra|comprando|adquirir)/i.test(normalized)) {
    return { intent: "buy", transaction_type: "sale" }
  }
  if (/(alugar|aluguel|loca(c|ç)(a|ã)o|locar)/i.test(normalized)) {
    return { intent: "rent", transaction_type: "rent" }
  }
  if (/(vender|venda|anunciar meu im[oó]vel)/i.test(normalized)) {
    return { intent: "sell", transaction_type: "sale" }
  }
  return { intent: null, transaction_type: null }
}

export function extractPropertyType(message: string) {
  const normalized = message.toLowerCase()
  const match = PROPERTY_TYPE_KEYWORDS.find((item) => item.terms.some((term) => normalized.includes(term)))
  return match?.value ?? null
}

export function extractLocation(message: string) {
  const cleaned = normalizeAiText(message, 120)
  if (!cleaned) return { city: null, neighborhoods: null }

  const parts = cleaned
    .split(/[;,/]| e /i)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return { city: null, neighborhoods: null }
  if (parts.length === 1) return { city: parts[0], neighborhoods: [parts[0]] }

  return {
    city: parts[0],
    neighborhoods: parts,
  }
}

export function extractTimeline(message: string) {
  const normalized = message.toLowerCase()
  if (/(hoje|agora|imediat|urgente|essa semana)/i.test(normalized)) return "immediate"
  if (/(este m[eê]s|30 dias|um m[eê]s|1 m[eê]s)/i.test(normalized)) return "30_days"
  if (/(60 dias|90 dias|alguns meses|sem pressa|estou pesquisando)/i.test(normalized)) return "researching"
  return normalizeAiText(message, 120)
}

export function applyQualificationStep(
  currentStep: string | null | undefined,
  message: string,
  current: QualificationSnapshot
): QualificationSnapshot {
  const step = (AI_LEAD_STEPS.find((item) => item === currentStep) ?? "intent") as AiLeadStep

  if (step === "intent") {
    return { ...current, ...extractIntent(message) }
  }

  if (step === "property_type") {
    return { ...current, property_type: extractPropertyType(message) ?? normalizeAiText(message, 80) }
  }

  if (step === "location") {
    return { ...current, ...extractLocation(message) }
  }

  if (step === "budget") {
    return { ...current, ...extractBudgetRange(message) }
  }

  return { ...current, timeline: extractTimeline(message) }
}

export function computeAiStageScore(snapshot: QualificationSnapshot) {
  let score = 0
  if (snapshot.intent) score += 20
  if (snapshot.property_type) score += 20
  if (snapshot.city || (snapshot.neighborhoods?.length ?? 0) > 0) score += 20
  if (snapshot.budget_max) score += 20
  if (snapshot.timeline) score += 20
  return Math.max(0, Math.min(100, score))
}

export function isCommerciallyQualified(snapshot: QualificationSnapshot) {
  return Boolean(
    snapshot.intent &&
      snapshot.property_type &&
      (snapshot.city || (snapshot.neighborhoods?.length ?? 0) > 0) &&
      snapshot.budget_max &&
      snapshot.timeline
  )
}

export function hasStrongCommercialTrigger(message: string) {
  return /(visita|visitar|proposta|falar com (um )?(corretor|humano)|financiamento|dispon[ií]vel)/i.test(
    message.toLowerCase()
  )
}

export function nextAiQuestion(snapshot: QualificationSnapshot) {
  if (!snapshot.intent) {
    return {
      nextStep: "intent" as AiLeadStep,
      message: "Você está buscando comprar ou alugar um imóvel?",
    }
  }

  if (!snapshot.property_type) {
    return {
      nextStep: "property_type" as AiLeadStep,
      message: "Perfeito. Qual tipo de imóvel você procura?",
    }
  }

  if (!snapshot.city && (snapshot.neighborhoods?.length ?? 0) === 0) {
    return {
      nextStep: "location" as AiLeadStep,
      message: "Em qual cidade ou bairro você gostaria de encontrar esse imóvel?",
    }
  }

  if (!snapshot.budget_max) {
    return {
      nextStep: "budget" as AiLeadStep,
      message: "Qual faixa de preço você tem em mente para esse imóvel?",
    }
  }

  if (!snapshot.timeline) {
    return {
      nextStep: "timeline" as AiLeadStep,
      message: "E qual é o seu prazo ou nível de urgência para fechar esse negócio?",
    }
  }

  return {
    nextStep: "timeline" as AiLeadStep,
    message: "Perfeito. Vou organizar tudo e encaminhar um corretor para continuar com você.",
  }
}

export function buildAiSummary(snapshot: QualificationSnapshot) {
  const parts: string[] = []

  if (snapshot.intent === "buy") parts.push("Busca compra")
  if (snapshot.intent === "rent") parts.push("Busca aluguel")
  if (snapshot.intent === "sell") parts.push("Busca venda")
  if (snapshot.property_type) parts.push(`tipo ${snapshot.property_type}`)
  if (snapshot.city) parts.push(`cidade ${snapshot.city}`)
  if ((snapshot.neighborhoods?.length ?? 0) > 0) parts.push(`região ${snapshot.neighborhoods?.join(", ")}`)
  if (snapshot.budget_max) {
    const budget =
      snapshot.budget_min && snapshot.budget_min < snapshot.budget_max
        ? `entre R$ ${snapshot.budget_min.toLocaleString("pt-BR")} e R$ ${snapshot.budget_max.toLocaleString("pt-BR")}`
        : `até R$ ${snapshot.budget_max.toLocaleString("pt-BR")}`
    parts.push(budget)
  }
  if (snapshot.timeline) parts.push(`prazo ${snapshot.timeline}`)

  if (parts.length === 0) return null
  return parts.join(" • ")
}
