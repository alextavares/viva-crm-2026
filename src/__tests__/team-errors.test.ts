import { mapTeamBusinessError } from "@/lib/team/errors"

describe("mapTeamBusinessError", () => {
  it("maps seat limit errors from details", () => {
    const mapped = mapTeamBusinessError({
      message: "Falha ao atualizar status do corretor.",
      details: "broker_seat_limit_reached",
    })

    expect(mapped.code).toBe("broker_seat_limit_reached")
  })

  it("maps invite pending errors", () => {
    const mapped = mapTeamBusinessError({
      message: "Já existe convite pendente para este email.",
    })

    expect(mapped.code).toBe("invite_already_pending")
  })

  it("returns unknown when message is empty", () => {
    const mapped = mapTeamBusinessError({
      message: "",
      details: null,
    })

    expect(mapped.code).toBe("unknown")
    expect(mapped.message).toBe("Erro inesperado.")
  })
})

