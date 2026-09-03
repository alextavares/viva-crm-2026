import { getAttendanceNextAction } from "@/lib/attendances/attendance-next-action"

describe("getAttendanceNextAction", () => {
  const now = new Date("2026-05-11T20:00:00.000Z")

  it("prioritizes new leads with no interaction as first contact", () => {
    expect(
      getAttendanceNextAction({
        status: "new",
        dealStage: "lead",
        latestLeadAt: "2026-05-11T19:50:00.000Z",
        latestInteractionAt: null,
        nextAppointmentAt: null,
        hasPhone: true,
        now,
        slaMinutes: 15,
      })
    ).toEqual({
      key: "first_contact",
      label: "Fazer primeiro contato",
      priority: "high",
      hrefKind: "whatsapp",
    })
  })

  it("marks new leads past SLA as overdue", () => {
    expect(
      getAttendanceNextAction({
        status: "new",
        dealStage: "lead",
        latestLeadAt: "2026-05-11T19:30:00.000Z",
        latestInteractionAt: null,
        nextAppointmentAt: null,
        hasPhone: true,
        now,
        slaMinutes: 15,
      })
    ).toEqual({
      key: "overdue_first_contact",
      label: "Responder lead atrasado",
      priority: "critical",
      hrefKind: "whatsapp",
    })
  })

  it("asks contacted leads to qualify and schedule", () => {
    expect(
      getAttendanceNextAction({
        status: "contacted",
        dealStage: "interest",
        latestLeadAt: "2026-05-11T18:00:00.000Z",
        latestInteractionAt: "2026-05-11T18:05:00.000Z",
        nextAppointmentAt: null,
        hasPhone: true,
        now,
        slaMinutes: 15,
      })
    ).toEqual({
      key: "qualify_or_schedule",
      label: "Qualificar e propor visita",
      priority: "medium",
      hrefKind: "appointment",
    })
  })

  it("surfaces upcoming visits as confirmation work", () => {
    expect(
      getAttendanceNextAction({
        status: "qualified",
        dealStage: "visit",
        latestLeadAt: "2026-05-10T18:00:00.000Z",
        latestInteractionAt: "2026-05-10T18:05:00.000Z",
        nextAppointmentAt: "2026-05-12T11:30:00.000Z",
        hasPhone: true,
        now,
        slaMinutes: 15,
      })
    ).toEqual({
      key: "confirm_visit",
      label: "Confirmar visita agendada",
      priority: "medium",
      hrefKind: "appointment",
    })
  })

  it("falls back to opening the contact when phone is missing", () => {
    expect(
      getAttendanceNextAction({
        status: "new",
        dealStage: "lead",
        latestLeadAt: "2026-05-11T19:50:00.000Z",
        latestInteractionAt: null,
        nextAppointmentAt: null,
        hasPhone: false,
        now,
        slaMinutes: 15,
      })
    ).toEqual({
      key: "complete_contact",
      label: "Completar telefone do lead",
      priority: "high",
      hrefKind: "contact",
    })
  })
})
