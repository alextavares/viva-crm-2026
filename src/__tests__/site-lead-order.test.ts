import { sortByLatestLeadActivity } from "@/lib/contacts/site-lead-order"

describe("sortByLatestLeadActivity", () => {
  it("prioritizes the latest lead event even when the contact is old", () => {
    const rows = sortByLatestLeadActivity([
      {
        id: "old-contact",
        created_at: "2026-02-17T15:00:46.300921+00:00",
        latestLeadAt: "2026-04-29T19:48:56.708136+00:00",
      },
      {
        id: "new-contact",
        created_at: "2026-04-29T15:23:09.742206+00:00",
        latestLeadAt: "2026-04-29T15:23:09.742206+00:00",
      },
    ])

    expect(rows.map((row) => row.id)).toEqual(["old-contact", "new-contact"])
  })

  it("falls back to created_at when latestLeadAt is missing", () => {
    const rows = sortByLatestLeadActivity([
      {
        id: "older",
        created_at: "2026-04-28T10:00:00.000Z",
        latestLeadAt: null,
      },
      {
        id: "newer",
        created_at: "2026-04-29T10:00:00.000Z",
        latestLeadAt: null,
      },
    ])

    expect(rows.map((row) => row.id)).toEqual(["newer", "older"])
  })
})
