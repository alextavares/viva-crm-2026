export type TeamBusinessErrorCode =
  | "broker_seat_limit_reached"
  | "invite_already_pending"
  | "not_found"
  | "validation_error"
  | "unknown"

type SupabaseLikeError = {
  message?: string | null
  details?: string | null
  code?: string | null
}

export function mapTeamBusinessError(error: SupabaseLikeError | null | undefined): {
  code: TeamBusinessErrorCode
  message: string
} {
  const message = (error?.message || "").trim()
  const details = (error?.details || "").trim()

  if (details.includes("broker_seat_limit_reached") || message.includes("Limite de corretores do plano atingido")) {
    return {
      code: "broker_seat_limit_reached",
      message: message || "Limite de corretores do plano atingido.",
    }
  }

  if (details.includes("already_pending") || message.toLowerCase().includes("convite pendente")) {
    return {
      code: "invite_already_pending",
      message: message || "Já existe convite pendente para este email.",
    }
  }

  if (message.toLowerCase().includes("not found")) {
    return {
      code: "not_found",
      message: message || "Registro não encontrado.",
    }
  }

  if (!message) {
    return {
      code: "unknown",
      message: "Erro inesperado.",
    }
  }

  return {
    code: "unknown",
    message,
  }
}

