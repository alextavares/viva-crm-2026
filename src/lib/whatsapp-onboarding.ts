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
      title: "Liberar WhatsApp oficial",
      description: "Ative o canal oficial para esta organização e siga para a conexão do número.",
      href: "/settings/whatsapp-addon",
      cta: "Abrir configuração",
      state: addonDone ? "done" : "pending",
    },
    {
      id: "channel",
      title: "Conectar número oficial",
      description: "Preencha os dados da Meta e deixe o número em status conectado.",
      href: "/settings/whatsapp-channel",
      cta: "Conectar número",
      state: addonDone ? (channelConnected ? "done" : "pending") : "blocked",
    },
    {
      id: "test",
      title: "Enviar teste",
      description: "Faça um teste de conexão e confirme que o canal está pronto para uso.",
      href: "/settings/whatsapp-channel",
      cta: "Testar conexão",
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

