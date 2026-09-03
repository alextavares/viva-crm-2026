import {
  buildAppointmentDefaultValues,
  mergeAppointmentPropertyOptions,
  type AppointmentPropertyOption,
} from "@/lib/appointments/appointment-defaults"

describe("appointment defaults", () => {
  it("preselects contact and property when both are known", () => {
    expect(
      buildAppointmentDefaultValues({
        contactId: "contact-1",
        propertyId: "property-1",
      })
    ).toEqual({
      contact_id: "contact-1",
      property_id: "property-1",
      status: "scheduled",
    })
  })

  it("keeps current options and appends preselected property when missing", () => {
    const options: AppointmentPropertyOption[] = [
      { id: "property-2", label: "Casa Centro" },
    ]

    expect(
      mergeAppointmentPropertyOptions(options, {
        id: "property-1",
        title: "Apartamento Vista Mar",
        public_code: "V-101",
      })
    ).toEqual([
      { id: "property-2", label: "Casa Centro" },
      { id: "property-1", label: "[V-101] Apartamento Vista Mar" },
    ])
  })
})
