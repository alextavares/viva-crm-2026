import { fireEvent, render, screen } from "@testing-library/react"

import { PropertyFormStepNav } from "@/components/properties/property-form-step-nav"

describe("PropertyFormStepNav", () => {
  it("lets the user move between property form steps", async () => {
    const onStepChange = jest.fn()

    render(
      <PropertyFormStepNav
        activeStep="essentials"
        issueCounts={{
          essentials: 0,
          owner: 1,
          commercial: 0,
          location: 2,
          media: 0,
          publication: 0,
        }}
        onStepChange={onStepChange}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: /proprietário/i }))

    expect(onStepChange).toHaveBeenCalledWith("owner")
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
  })
})
