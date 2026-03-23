import { PublicSurfacePanel } from "@/components/public/public-section-blocks"

const TRUST_ITEMS = [
  "Equipe local com atendimento consultivo",
  "Suporte para compra, locação e captação",
  "Contato rápido por WhatsApp e CRM integrado",
]

export function PublicTrustStrip() {
  return (
    <section className="mt-8 grid gap-4 md:grid-cols-3">
      {TRUST_ITEMS.map((item) => (
        <PublicSurfacePanel key={item} theme="trust_first" className="p-5 text-sm font-medium">
          {item}
        </PublicSurfacePanel>
      ))}
    </section>
  )
}
