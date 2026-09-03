import type { AttendanceQueueRow } from "@/lib/attendances/attendance-types"

export type AttendanceMetrics = {
  total: number
  newWithoutContact: number
  inProgress: number
  overdue: number
  upcomingVisits: number
}

export function getAttendanceMetrics(rows: AttendanceQueueRow[]): AttendanceMetrics {
  return rows.reduce<AttendanceMetrics>(
    (acc, row) => {
      acc.total += 1

      if (row.status === "new") {
        acc.newWithoutContact += 1
      }

      if (row.status === "contacted") {
        acc.inProgress += 1
      }

      if (row.nextAction.priority === "critical") {
        acc.overdue += 1
      }

      if (row.nextAppointmentAt) {
        acc.upcomingVisits += 1
      }

      return acc
    },
    {
      total: 0,
      newWithoutContact: 0,
      inProgress: 0,
      overdue: 0,
      upcomingVisits: 0,
    }
  )
}
