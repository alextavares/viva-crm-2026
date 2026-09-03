import type { AttendanceNextAction, AttendanceNextActionInput } from "@/lib/attendances/attendance-types"

function minutesSince(value: string | null, now: Date) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000))
}

export function getAttendanceNextAction(input: AttendanceNextActionInput): AttendanceNextAction {
  const now = input.now ?? new Date()
  const elapsedLeadMinutes = minutesSince(input.latestLeadAt, now)
  const slaMinutes = Math.max(1, input.slaMinutes || 15)

  if (!input.hasPhone) {
    return {
      key: "complete_contact",
      label: "Completar telefone do lead",
      priority: "high",
      hrefKind: "contact",
    }
  }

  if (input.nextAppointmentAt) {
    return {
      key: "confirm_visit",
      label: "Confirmar visita agendada",
      priority: "medium",
      hrefKind: "appointment",
    }
  }

  if (input.status === "new") {
    if (elapsedLeadMinutes !== null && elapsedLeadMinutes > slaMinutes) {
      return {
        key: "overdue_first_contact",
        label: "Responder lead atrasado",
        priority: "critical",
        hrefKind: "whatsapp",
      }
    }

    return {
      key: "first_contact",
      label: "Fazer primeiro contato",
      priority: "high",
      hrefKind: "whatsapp",
    }
  }

  if (input.status === "contacted") {
    return {
      key: "qualify_or_schedule",
      label: "Qualificar e propor visita",
      priority: "medium",
      hrefKind: "appointment",
    }
  }

  return {
    key: "follow_up",
    label: "Fazer follow-up do atendimento",
    priority: "low",
    hrefKind: "whatsapp",
  }
}
