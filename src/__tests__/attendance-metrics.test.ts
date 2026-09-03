import { getAttendanceMetrics } from "@/lib/attendances/attendance-metrics"
import type { AttendanceQueueRow } from "@/lib/attendances/attendance-types"

function row(overrides: Partial<AttendanceQueueRow>): AttendanceQueueRow {
  return {
    id: "contact-1",
    name: "Lead Teste",
    email: null,
    phone: "11999999999",
    status: "new",
    type: "lead",
    deal_stage: "lead",
    assigned_to: "broker-1",
    organization_id: "org-1",
    city: null,
    created_at: "2026-05-11T18:00:00.000Z",
    siteMeta: null,
    latestLeadAt: "2026-05-11T18:00:00.000Z",
    latestInteractionAt: null,
    latestInteractionSummary: null,
    nextAppointmentAt: null,
    nextAppointmentId: null,
    assignedProfileName: "Broker Demo",
    leadPropertyContext: null,
    nextAction: {
      key: "first_contact",
      label: "Fazer primeiro contato",
      priority: "high",
      hrefKind: "whatsapp",
    },
    ...overrides,
  }
}

describe("getAttendanceMetrics", () => {
  it("counts queue states without mutating rows", () => {
    const rows = [
      row({ id: "new-1", status: "new" }),
      row({ id: "contacted-1", status: "contacted" }),
      row({
        id: "overdue-1",
        status: "new",
        nextAction: {
          key: "overdue_first_contact",
          label: "Responder lead atrasado",
          priority: "critical",
          hrefKind: "whatsapp",
        },
      }),
      row({
        id: "visit-1",
        status: "qualified",
        nextAppointmentAt: "2026-05-12T11:30:00.000Z",
        nextAction: {
          key: "confirm_visit",
          label: "Confirmar visita agendada",
          priority: "medium",
          hrefKind: "appointment",
        },
      }),
    ]

    expect(getAttendanceMetrics(rows)).toEqual({
      total: 4,
      newWithoutContact: 2,
      inProgress: 1,
      overdue: 1,
      upcomingVisits: 1,
    })
  })
})
