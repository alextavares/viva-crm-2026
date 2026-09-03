type WhatsAppContextInput = {
  contactName?: string | null
  propertyTitle?: string | null
  propertyCode?: string | null
  propertyAddress?: string | null
}

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function firstName(value: string | null | undefined) {
  return clean(value).split(" ").filter(Boolean)[0] ?? ""
}

export function formatPropertyContext(input: WhatsAppContextInput) {
  const title = clean(input.propertyTitle)
  const code = clean(input.propertyCode)
  const address = clean(input.propertyAddress)

  if (title && code) return `"${title}" (Ref. ${code})`
  if (title) return `"${title}"`
  if (code) return `Ref. ${code}`
  if (address) return address
  return ""
}

export function buildBrokerWhatsAppMessage(input: WhatsAppContextInput) {
  const name = firstName(input.contactName)
  const greeting = name ? `Olá ${name}, tudo bem?` : "Olá, tudo bem?"
  const propertyContext = formatPropertyContext(input)

  if (propertyContext) {
    return `${greeting} Vi seu interesse no imóvel ${propertyContext}. Posso te passar mais detalhes e combinar o próximo passo?`
  }

  return `${greeting} Vi seu interesse e posso te ajudar com as próximas informações. Posso falar por aqui?`
}

export function buildExternalWhatsAppTraceSummary(input: WhatsAppContextInput) {
  const propertyContext = formatPropertyContext(input)
  if (propertyContext) {
    return `WhatsApp externo aberto com contexto do imóvel ${propertyContext}.`
  }

  return "WhatsApp externo aberto para atendimento do lead."
}
