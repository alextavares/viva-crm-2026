import { formatPropertyLabel } from "@/lib/contacts/lead-property-context"

export type AppointmentPropertyOption = {
  id: string
  label: string
}

export type AppointmentPropertyRecord = {
  id: string
  title: string | null
  public_code: string | null
}

export function buildAppointmentDefaultValues(input: {
  contactId?: string | null
  propertyId?: string | null
}) {
  const contactId = input.contactId?.trim()
  const propertyId = input.propertyId?.trim()

  if (!contactId && !propertyId) return undefined

  return {
    contact_id: contactId ?? "",
    property_id: propertyId ?? "",
    status: "scheduled" as const,
  }
}

export function buildAppointmentPropertyLabel(property: AppointmentPropertyRecord) {
  return formatPropertyLabel(property.title?.trim() || "Imóvel sem título", property.public_code)
}

export function mergeAppointmentPropertyOptions(
  properties: AppointmentPropertyOption[],
  preselectedProperty: AppointmentPropertyRecord | null
) {
  if (!preselectedProperty) return properties
  if (properties.some((property) => property.id === preselectedProperty.id)) {
    return properties
  }

  return [
    ...properties,
    {
      id: preselectedProperty.id,
      label: buildAppointmentPropertyLabel(preselectedProperty),
    },
  ]
}
