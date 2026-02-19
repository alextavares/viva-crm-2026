import type { Metadata } from "next"
import Link from "next/link"
import { WhatsAppFab } from "@/components/marketing/whatsapp-fab"
import { getDemoSiteHref } from "@/lib/demo-site"

export const metadata: Metadata = {
  title: "Precos | VivaCRM",
  description: "Plano mensal simples para corretores e pequenas imobiliarias.",
}

function PriceLine({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-3">
      <div className="text-sm text-white/70">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

export default function PricingPage() {
  const salesPhone = process.env.NEXT_PUBLIC_SALES_WHATSAPP_E164 || "5511999999999"
  const salesText =
    process.env.NEXT_PUBLIC_SALES_WHATSAPP_TEXT ||
    "Oi! Quero testar o VivaCRM. Pode me ajudar com o plano e a configuracao do site?"
  const demoSiteHref = getDemoSiteHref()

  return (
    <main className="min-h-dvh bg-[#070910] text-zinc-50">
      <WhatsAppFab phoneE164={salesPhone} text={salesText} />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
            <span className="text-[13px] font-semibold tracking-wide">VC</span>
          </span>
          <span className="text-sm font-semibold">VivaCRM</span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/"
            className="rounded-xl px-3 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/5"
          >
            Voltar
          </Link>
          <Link
            href="/login"
            className="rounded-xl px-3 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/5"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-300"
          >
            Testar gratis
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-6 md:pb-24">
        <div className="grid gap-10 md:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Plano simples, sem fidelidade
            </div>
            <h1 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight md:text-5xl">
              Um plano para comecar a vender com site + CRM.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/70">
              Ideal para corretores e pequenas imobiliarias que querem um site bonito e um CRM funcional, sem pagar caro
              e sem precisar de implantacao.
            </p>

            <div className="mt-7 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <div className="text-xs text-white/60">Inclui</div>
              <ul className="mt-3 grid gap-2 text-sm text-white/75">
                <li>Site publico com template e personalizacao (logo, cores, banners)</li>
                <li>Catalogo de imoveis + pagina do imovel</li>
                <li>Formulario e WhatsApp que viram lead no CRM</li>
                <li>Funil Kanban + contatos + historico</li>
              </ul>
              <div className="mt-5 text-xs text-white/50">
                Observacao: dominio proprio e integracoes com portais entram como proxima etapa do roadmap.
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-b from-white/10 to-white/5 p-6 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">VivaCRM</div>
                <div className="mt-1 text-xs text-white/60">Mensal</div>
              </div>
              <div className="rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
                Sem fidelidade
              </div>
            </div>

            <div className="mt-6">
              <div className="text-4xl font-semibold tracking-tight">
                R$ 89,90<span className="text-base font-semibold text-white/60">/mes</span>
              </div>
              <div className="mt-2 text-sm text-white/65">Teste gratis e comece hoje. Sem cartao.</div>
            </div>

            <div className="mt-6 rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
              <PriceLine label="Site publico" value="Incluso" />
              <PriceLine label="Captura de leads" value="Incluso" />
              <PriceLine label="CRM (Kanban + contatos)" value="Incluso" />
              <PriceLine label="Suporte" value="Central de ajuda" />
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-300"
              >
                Testar gratis
              </Link>
              <Link
                href={demoSiteHref}
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
              >
                Ver demo do site
              </Link>
              <Link href="/#recursos" className="text-center text-sm text-white/70 hover:text-white">
                Ver recursos
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-sm font-semibold">Pergunta comum</div>
            <div className="mt-2 text-sm text-white/70">
              Preciso ter dominio agora?
              <div className="mt-1 text-white/60">
                Nao. Voce pode usar um subdominio para testar e publicar. Dominio proprio entra logo depois, com
                configuracao guiada.
              </div>
            </div>
          </div>
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-sm font-semibold">Pergunta comum</div>
            <div className="mt-2 text-sm text-white/70">
              Eu ja tenho dados de outro CRM. Consigo importar?
              <div className="mt-1 text-white/60">
                Sim. A ideia e importar imoveis e contatos. O onboarding vai ser feito para reduzir atrito e evitar
                suporte pesado.
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#070910]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-white/70 md:flex-row md:items-center md:justify-between">
          <div>VivaCRM</div>
          <div className="flex flex-wrap gap-4">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <Link href="/login" className="hover:text-white">
              Entrar
            </Link>
            <Link href="/register" className="hover:text-white">
              Testar
            </Link>
            <Link href={demoSiteHref} className="hover:text-white">
              Demo
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
