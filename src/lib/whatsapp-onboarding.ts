export type WhatsAppChannelStatus = "disconnected" | "connected" | "error" | null

export type WhatsAppOnboardingInput = {
  addonEnabled: boolean
  channelStatus: WhatsAppChannelStatus
  lastTestedAt: string | null
}

export type WhatsAppOnboardingStepState = "done" | "pending" | "blocked"

export type WhatsAppOnboardingStep = {
  id: "addon" | "channel" | "test"
  title: string
  description: string
  href: string
  cta: string
  state: WhatsAppOnboardingStepState
}

export type WhatsAppOnboardingSnapshot = {
  ready: boolean
  doneCount: number
  steps: WhatsAppOnboardingStep[]
}

export function getWhatsAppOnboardingSnapshot(input: WhatsAppOnboardingInput): WhatsAppOnboardingSnapshot {
  const addonDone = input.addonEnabled
  const channelConnected = input.channelStatus === "connected"
  const testDone = channelConnected && Boolean(input.lastTestedAt)

  const steps: WhatsAppOnboardingStep[] = [
    {
      id: "addon",
      title: "Contratar add-on",
      description: "Ative o add-on por organização para liberar envio oficial.",
      href: "/settings/whatsapp-addon",
      cta: "Configurar add-on",
      state: addonDone ? "done" : "pending",
    },
    {
      id: "channel",
      title: "Conectar canal oficial",
      description: "Preencha os dados Meta e deixe o canal em status conectado.",
      href: "/settings/whatsapp-channel",
      cta: "Conectar canal",
      state: addonDone ? (channelConnected ? "done" : "pending") : "blocked",
    },
    {
      id: "test",
      title: "Validar envio teste",
      description: "Execute o teste de conexão e confirme status pronto para uso.",
      href: "/settings/whatsapp-channel",
      cta: "Testar canal",
      state: addonDone ? (channelConnected ? (testDone ? "done" : "pending") : "blocked") : "blocked",
    },
  ]

  const doneCount = steps.filter((step) => step.state === "done").length
  const ready = doneCount === steps.length

  return {
    ready,
    doneCount,
    steps,
  }
}

