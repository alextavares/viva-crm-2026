import type { DealStage } from "@/lib/types"

export type AttendanceStatus = "new" | "contacted" | "qualified"

export type AttendancePriority = "critical" | "high" | "medium" | "low"

export type AttendanceActionKey =
  | "overdue_first_contact"
  | "first_contact"
  | "complete_contact"
  | "qualify_or_schedule"
  | "confirm_visit"
  | "follow_up"

export type AttendanceActionHrefKind = "whatsapp" | "appointment" | "contact"

export type AttendanceNextAction = {
  key: AttendanceActionKey
  label: string
  priority: AttendancePriority
  hrefKind: AttendanceActionHrefKind
}

export type AttendanceNextActionInput = {
  status: string | null
  dealStage: DealStage | string | null
  latestLeadAt: string | null
  latestInteractionAt: string | null
  nextAppointmentAt: string | null
  hasPhone: boolean
  now?: Date
  slaMinutes: number
}

export type AttendanceQueueRow = {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  type: string
  deal_stage?: string | null
  assigned_to?: string | null
  organization_id: string
  city?: string | null
  created_at: string | null
  updated_at?: string | null
  siteMeta?: {
    source: string | null
    domain: string | null
    lastEventAt: string | null
  } | null
  latestLeadAt?: string | null
  latestInteractionAt?: string | null
  latestInteractionSummary?: string | null
  nextAppointmentAt?: string | null
  nextAppointmentId?: string | null
  assignedProfileName?: string | null
  leadPropertyContext?: {
    id: string
    title: string
  } | null
  nextAction: AttendanceNextAction
}
