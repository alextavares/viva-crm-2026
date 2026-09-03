type AiLeadPriorityInput = {
  status: string | null | undefined
  stageScore: number | null | undefined
  lastMessageAt: string | null | undefined
  startedAt: string | null | undefined
  assignedToAtHandoff?: string | null | undefined
}

export type AiLeadPriorityLabel = "Alta" | "Media" | "Baixa"

function asTime(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export function getAiLeadPriorityScore(input: AiLeadPriorityInput, now = new Date()) {
  const status = input.status ?? ""
  const stageScore = input.stageScore ?? 0

  let score = 20
  if (status === "handoff_requested") score = 100
  else if (status === "qualified") score = 80
  else if (status === "active" && stageScore >= 80) score = 60
  else if (status === "active" && stageScore >= 50) score = 40
  else if (status === "paused") score = -10

  const lastMessageTime = asTime(input.lastMessageAt)
  const staleThresholdMs = 30 * 60 * 1000
  if (
    (status === "qualified" || status === "handoff_requested") &&
    lastMessageTime > 0 &&
    now.getTime() - lastMessageTime >= staleThresholdMs
  ) {
    score += 15
  }

  if (
    (status === "qualified" || status === "handoff_requested") &&
    !input.assignedToAtHandoff
  ) {
    score += 10
  }

  return score
}

export function getAiLeadPriorityLabel(score: number): AiLeadPriorityLabel {
  if (score >= 80) return "Alta"
  if (score >= 40) return "Media"
  return "Baixa"
}

export function getAiLeadPriorityClass(label: AiLeadPriorityLabel) {
  if (label === "Alta") return "bg-rose-100 text-rose-800 border-rose-200"
  if (label === "Media") return "bg-amber-100 text-amber-800 border-amber-200"
  return "bg-sky-100 text-sky-800 border-sky-200"
}

export function compareAiLeadPriority<T extends AiLeadPriorityInput>(a: T, b: T) {
  const scoreDiff = getAiLeadPriorityScore(b) - getAiLeadPriorityScore(a)
  if (scoreDiff !== 0) return scoreDiff

  const lastMessageDiff = asTime(b.lastMessageAt) - asTime(a.lastMessageAt)
  if (lastMessageDiff !== 0) return lastMessageDiff

  return asTime(b.startedAt) - asTime(a.startedAt)
}
