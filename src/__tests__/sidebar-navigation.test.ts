import { getVisibleSidebarItems } from "@/components/layout/sidebar"

describe("sidebar operational hierarchy", () => {
  it("keeps attendances as the first operational entry for broker", () => {
    const items = getVisibleSidebarItems("broker")

    expect(items.map((item) => item.title)).toEqual([
      "Atendimentos",
      "Dashboard",
      "Agenda",
      "Base de contatos",
      "Meus leads do site",
      "Imóveis",
      "Leads IA",
    ])
  })

  it("keeps admin areas visible only for owner/manager and secondary to routine", () => {
    const items = getVisibleSidebarItems("owner")

    expect(items[0]?.title).toBe("Atendimentos")
    expect(items[1]?.title).toBe("Dashboard")
    expect(items.some((item) => item.title === "Integrações")).toBe(true)
    expect(items.some((item) => item.title === "Configurações")).toBe(true)
  })
})
