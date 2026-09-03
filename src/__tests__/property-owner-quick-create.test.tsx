import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { PropertyOwnerQuickCreate } from "@/components/properties/property-owner-quick-create"

describe("PropertyOwnerQuickCreate", () => {
  it("creates an owner and returns it to the form", async () => {
    const createOwner = jest.fn().mockResolvedValue({
      success: true,
      data: { id: "owner-1", name: "Maria Proprietária" },
    })
    const onCreated = jest.fn()

    render(<PropertyOwnerQuickCreate createOwner={createOwner} onCreated={onCreated} />)

    fireEvent.click(screen.getByRole("button", { name: /novo proprietário/i }))
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Maria Proprietária" } })
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: "11999999999" } })
    fireEvent.click(screen.getByRole("button", { name: /criar proprietário/i }))

    await waitFor(() =>
      expect(createOwner).toHaveBeenCalledWith({
        name: "Maria Proprietária",
        phone: "11999999999",
        email: "",
      })
    )
    expect(onCreated).toHaveBeenCalledWith({ id: "owner-1", name: "Maria Proprietária" })
  })

  it("keeps typed values visible when creation fails", async () => {
    const createOwner = jest.fn().mockResolvedValue({
      success: false,
      error: "Falha ao criar proprietário.",
    })

    render(<PropertyOwnerQuickCreate createOwner={createOwner} onCreated={jest.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /novo proprietário/i }))
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: "Maria Proprietária" } })
    fireEvent.change(screen.getByLabelText(/telefone/i), { target: { value: "11999999999" } })
    fireEvent.click(screen.getByRole("button", { name: /criar proprietário/i }))

    await screen.findByText("Falha ao criar proprietário.")
    expect(screen.getByLabelText(/nome/i)).toHaveValue("Maria Proprietária")
    expect(screen.getByLabelText(/telefone/i)).toHaveValue("11999999999")
  })
})
