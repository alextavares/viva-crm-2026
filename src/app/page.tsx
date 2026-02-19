import type { Metadata } from "next"
import Link from "next/link"
import { WhatsAppFab } from "@/components/marketing/whatsapp-fab"
import { getDemoSiteHref } from "@/lib/demo-site"

export default function Home() {
  const salesPhone = process.env.NEXT_PUBLIC_SALES_WHATSAPP_E164 || "5511999999999"
  const salesText =
    process.env.NEXT_PUBLIC_SALES_WHATSAPP_TEXT ||
    "Oi! Quero testar o VivaCRM. Voce pode me ajudar a configurar meu site e importar meus imoveis?"
  const demoSiteHref = getDemoSiteHref()

  return (
    <main className="min-h-dvh bg-[#070910] text-zinc-50">
      <WhatsAppFab phoneE164={salesPhone} text={salesText} />
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.32),transparent_62%)] blur-2xl" />
          <div className="absolute -right-40 top-24 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.22),transparent_62%)] blur-2xl" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <Link href="/" className="group inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
              <span className="text-[13px] font-semibold tracking-wide">VC</span>
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">VivaCRM</span>
              <span className="block text-xs text-white/60">CRM + Site para imobiliárias</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-white/80 md:flex">
            <a href="#recursos" className="hover:text-white">
              Recursos
            </a>
            <a href="#templates" className="hover:text-white">
              Templates
            </a>
            <Link href="/precos" className="hover:text-white">
              Preços
            </Link>
            <Link href="/login" className="hover:text-white">
              Entrar
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl px-3 py-2 text-sm text-white/80 ring-1 ring-white/10 hover:bg-white/5 md:inline-flex"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-b from-white to-white/90 px-4 py-2 text-sm font-semibold text-black shadow-sm shadow-white/10 ring-1 ring-white/10 hover:from-white hover:to-white"
            >
              Testar gratis
            </Link>
          </div>
        </header>

        <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-5 pb-14 pt-6 md:grid-cols-[1.2fr_0.8fr] md:pb-20 md:pt-10">
          <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Feito para corretores e pequenas imobiliarias
            </div>

            <h1 className="mt-5 font-serif text-4xl leading-[1.03] tracking-tight text-white md:text-6xl">
              Um CRM simples com o{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-lime-200 to-amber-200 bg-clip-text text-transparent">
                site mais bonito
              </span>{" "}
              para vender imoveis.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
              Publique seus imoveis em um site rapido e elegante. Cada mensagem vira lead e entra direto no CRM, sem
              planilhas e sem bagunca.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-400/20 hover:bg-emerald-300"
              >
                Criar minha conta
              </Link>
              <Link
                href={demoSiteHref}
                className="inline-flex items-center justify-center rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
              >
                Ver demo do site
              </Link>
              <Link
                href="/precos"
                className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white/80 hover:text-white"
              >
                Ver preco
              </Link>
            </div>

            <div className="mt-3 text-xs text-white/55">
              Prefere falar com humano? Clique no botao do WhatsApp no canto inferior direito.
            </div>

            <div className="mt-7 grid gap-3 text-sm text-white/70 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-xs text-white/50">Tempo de valor</div>
                <div className="mt-1 font-semibold text-white">10 min</div>
                <div className="mt-1 text-white/60">Conta, site e primeiro lead.</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-xs text-white/50">Leads</div>
                <div className="mt-1 font-semibold text-white">Entram no CRM</div>
                <div className="mt-1 text-white/60">Formulario e WhatsApp.</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-xs text-white/50">Sem fidelidade</div>
                <div className="mt-1 font-semibold text-white">Cancelamento facil</div>
                <div className="mt-1 text-white/60">Low touch, sem drama.</div>
              </div>
            </div>
          </div>

          <div className="relative motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700 motion-safe:delay-150">
            <div className="rounded-3xl bg-gradient-to-b from-white/10 to-white/5 p-5 ring-1 ring-white/10">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Demo</div>
                <span className="rounded-full bg-black/30 px-2 py-1 text-xs text-white/70 ring-1 ring-white/10">
                  {demoSiteHref}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-white/60">Template</div>
                  <div className="mt-1 text-lg font-semibold">Search-first</div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10">
                    <div className="h-2 w-[72%] rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" />
                  </div>
                  <div className="mt-2 text-xs text-white/60">Foco total em conversao.</div>
                </div>

                <div className="rounded-2xl bg-black/30 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-white/60">O que o cliente ve</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-emerald-500/30 to-transparent ring-1 ring-white/10" />
                    <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-amber-500/25 to-transparent ring-1 ring-white/10" />
                    <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-lime-500/25 to-transparent ring-1 ring-white/10" />
                  </div>
                  <div className="mt-3 text-xs text-white/60">
                    Cards de imoveis, pagina do imovel e formulario que vira lead.
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link
                  href={demoSiteHref}
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
                >
                  Abrir demo
                </Link>
                <Link
                  href="/register"
                  className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90"
                >
                  Comecar agora
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section id="recursos" className="mx-auto max-w-6xl px-5 pb-16 pt-8 md:pb-24">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="font-serif text-2xl text-white md:text-3xl">Recursos essenciais</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/65 md:text-base">
              O basico que resolve o dia a dia: captacao, organizacao, agilidade e um site que passa confianca.
            </p>
          </div>
          <Link
            href="/precos"
            className="hidden rounded-xl bg-white/5 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 md:inline-flex"
          >
            Ver plano
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-xs text-white/50">Funil</div>
            <div className="mt-2 text-lg font-semibold">Kanban rapido</div>
            <p className="mt-2 text-sm text-white/65">
              Arraste leads entre etapas e enxergue o que esta esfriando agora.
            </p>
          </div>
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-xs text-white/50">Contatos</div>
            <div className="mt-2 text-lg font-semibold">Base unica</div>
            <p className="mt-2 text-sm text-white/65">
              Nome, WhatsApp e historico. Sem duplicacao e sem perder conversa.
            </p>
          </div>
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-xs text-white/50">Site</div>
            <div className="mt-2 text-lg font-semibold">Lindo no mobile</div>
            <p className="mt-2 text-sm text-white/65">
              Template pronto, cores e banners. O lead entra no CRM automaticamente.
            </p>
          </div>
        </div>

        <div className="mt-10 rounded-3xl bg-gradient-to-r from-emerald-400/15 via-white/5 to-amber-300/10 p-6 ring-1 ring-white/10 md:p-8">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="text-xs text-white/60">Proximo passo</div>
              <div className="mt-1 text-lg font-semibold text-white">Ative seu site e comece a capturar leads hoje</div>
              <div className="mt-1 text-sm text-white/65">Sem cartao. Sem fidelidade. Sem configuracao complicada.</div>
            </div>
            <div className="flex w-full gap-2 md:w-auto">
              <Link
                href="/register"
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-300 md:flex-none"
              >
                Testar gratis
              </Link>
              <Link
                href={demoSiteHref}
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 md:flex-none"
              >
                Ver demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="templates" className="border-t border-white/10 bg-black/30">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 md:pb-24">
          <h2 className="font-serif text-2xl text-white md:text-3xl">Templates para escolher</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/65 md:text-base">
            Quando formos vender, voce escolhe um modelo e personaliza. O conteudo continua seu.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <div className="text-xs text-white/50">Template 01</div>
              <div className="mt-2 text-lg font-semibold">Search-first</div>
              <p className="mt-2 text-sm text-white/65">Para conversao: busca, cards e formulario sempre visivel.</p>
              <div className="mt-4 aspect-[16/10] rounded-2xl bg-gradient-to-br from-emerald-500/30 via-white/5 to-transparent ring-1 ring-white/10" />
            </div>
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <div className="text-xs text-white/50">Template 02</div>
              <div className="mt-2 text-lg font-semibold">Premium</div>
              <p className="mt-2 text-sm text-white/65">Mais editorial, fotos grandes e destaque para conteudo.</p>
              <div className="mt-4 aspect-[16/10] rounded-2xl bg-gradient-to-br from-amber-500/25 via-white/5 to-transparent ring-1 ring-white/10" />
            </div>
            <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
              <div className="text-xs text-white/50">Template 03</div>
              <div className="mt-2 text-lg font-semibold">Minimal</div>
              <p className="mt-2 text-sm text-white/65">Carrega muito rapido e fica impecavel no mobile.</p>
              <div className="mt-4 aspect-[16/10] rounded-2xl bg-gradient-to-br from-lime-500/25 via-white/5 to-transparent ring-1 ring-white/10" />
            </div>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 md:flex-row md:items-center md:p-8">
            <div>
              <div className="text-sm font-semibold">Quer ver um exemplo real?</div>
              <div className="mt-1 text-sm text-white/65">Abra o demo e navegue como seu cliente navegaria.</div>
            </div>
            <Link
              href={demoSiteHref}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
            >
              Abrir demo agora
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#070910]">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 md:pb-24">
          <div className="grid gap-10 md:grid-cols-[1fr_1fr]">
            <div>
              <h2 className="font-serif text-2xl text-white md:text-3xl">Feito para vender, sem enrolacao</h2>
              <p className="mt-2 max-w-xl text-sm text-white/65 md:text-base">
                O VivaCRM foi desenhado para quem vive de lead: resposta rapida, organizacao simples e um site que passa
                confianca.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
                  <div className="text-xs text-white/50">Setup</div>
                  <div className="mt-2 text-lg font-semibold">Rápido</div>
                  <div className="mt-1 text-sm text-white/65">Conta, site e primeiro lead em minutos.</div>
                </div>
                <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
                  <div className="text-xs text-white/50">Time</div>
                  <div className="mt-2 text-lg font-semibold">Sem perda</div>
                  <div className="mt-1 text-sm text-white/65">Nada fica no WhatsApp sem virar lead.</div>
                </div>
                <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
                  <div className="text-xs text-white/50">Custo</div>
                  <div className="mt-2 text-lg font-semibold">Baixo</div>
                  <div className="mt-1 text-sm text-white/65">Preco acessivel para crescer em volume.</div>
                </div>
              </div>

              <div className="mt-6 rounded-3xl bg-gradient-to-r from-emerald-400/15 via-white/5 to-amber-300/10 p-6 ring-1 ring-white/10">
                <div className="text-xs text-white/60">Depoimento</div>
                <div className="mt-2 text-sm text-white/75">
                  “Eu precisava de um site bonito e um jeito simples de organizar meus leads. O VivaCRM virou minha base
                  do dia a dia.”
                </div>
                <div className="mt-3 text-xs text-white/50">Corretor autonomo, litoral SP</div>
              </div>
            </div>

            <div>
              <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="text-sm font-semibold">FAQ rapido</div>
                <div className="mt-4 grid gap-4 text-sm text-white/70">
                  <div>
                    <div className="font-semibold text-white">Preciso ter dominio proprio agora?</div>
                    <div className="mt-1 text-white/60">
                      Nao. Voce comeca com subdominio e ativa dominio proprio depois, com passo a passo.
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">Tenho dados de outro CRM. Consigo importar?</div>
                    <div className="mt-1 text-white/60">
                      Sim. O objetivo e importar imoveis e contatos sem dor. Vamos deixar isso guiado no onboarding.
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">Os leads do site entram onde?</div>
                    <div className="mt-1 text-white/60">Entram direto no CRM como contato/lead com historico.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">Tem fidelidade?</div>
                    <div className="mt-1 text-white/60">Nao. Cancelamento simples.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">Portais (ZAP, VivaReal, OLX, ImovelWeb) estao inclusos?</div>
                    <div className="mt-1 text-white/60">
                      Integracoes com portais sao essenciais e entram como proxima fase. Hoje voce ja tem site + captura
                      de lead.
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">Preciso instalar app?</div>
                    <div className="mt-1 text-white/60">Nao. Funciona no navegador, perfeito no celular.</div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href="/register"
                    className="inline-flex flex-1 items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-300"
                  >
                    Testar gratis
                  </Link>
                  <Link
                    href={demoSiteHref}
                    className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
                  >
                    Ver demo
                  </Link>
                </div>
              </div>

              <div className="mt-4 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                <div className="text-sm font-semibold">Quer falar com a gente?</div>
                <div className="mt-2 text-sm text-white/65">
                  Se voce ja tem operacao rodando e quer migrar rapido, chama no WhatsApp. A gente ajuda a decidir o
                  melhor caminho.
                </div>
                <div className="mt-4 text-xs text-white/50">
                  Dica: use o botao do WhatsApp no canto inferior direito.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#070910]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-white/70 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
              <span className="text-[12px] font-semibold">VC</span>
            </span>
            <span>VivaCRM</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/precos" className="hover:text-white">
              Precos
            </Link>
            <Link href="/login" className="hover:text-white">
              Entrar
            </Link>
            <Link href="/register" className="hover:text-white">
              Criar conta
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

export const metadata: Metadata = {
  title: "VivaCRM | CRM + Site Para Corretores e Imobiliarias",
  description:
    "CRM simples + site bonito para corretores e pequenas imobiliarias. Leads do site entram direto no CRM.",
}
