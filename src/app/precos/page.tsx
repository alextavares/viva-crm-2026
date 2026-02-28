import type { Metadata } from "next"
import Link from "next/link"
import { WhatsAppFab } from "@/components/marketing/whatsapp-fab"
import { MarketingHeader } from "@/components/marketing/marketing-header"
import { MarketingFooter } from "@/components/marketing/marketing-footer"
import { getDemoSiteHref } from "@/lib/demo-site"

export const metadata: Metadata = {
  title: "Precos | VivaCRM",
  description: "Planos VivaCRM para corretores e pequenas imobiliarias com opcao de WhatsApp Oficial.",
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
      <MarketingHeader active="precos" />

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-6 md:pb-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 ring-1 ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Sem fidelidade. Upgrade quando quiser.
          </div>
          <h1 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight md:text-5xl">
            Planos simples para crescer do autonomo a equipe.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70">
            Comece em R$ 89 e evolua sem trocar de sistema. WhatsApp Oficial entra como add-on para manter custo
            transparente.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-xs text-white/50">Start</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              R$ 89<span className="text-sm font-medium text-white/60">/mes</span>
            </div>
            <p className="mt-2 text-sm text-white/65">Para corretor autonomo.</p>
            <ul className="mt-4 grid gap-2 text-sm text-white/75">
              <li>CRM + site imobiliario</li>
              <li>Imoveis e clientes ilimitados</li>
              <li>Integracao com portais</li>
              <li>Dominio proprio</li>
            </ul>
            <Link
              href="/register"
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-black hover:bg-emerald-300"
            >
              Escolher Start
            </Link>
          </div>

          <div className="rounded-3xl bg-gradient-to-b from-white/10 to-white/5 p-6 ring-1 ring-emerald-300/25">
            <div className="text-xs text-emerald-300">Equipe</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              R$ 129<span className="text-sm font-medium text-white/60">/mes</span>
            </div>
            <p className="mt-2 text-sm text-white/65">Para imobiliaria pequena.</p>
            <ul className="mt-4 grid gap-2 text-sm text-white/75">
              <li>Tudo do Start</li>
              <li>Ate 5 usuarios</li>
              <li>Distribuicao de leads + SLA</li>
              <li>Metas no dashboard</li>
            </ul>
            <Link
              href="/register"
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/90"
            >
              Escolher Equipe
            </Link>
          </div>

          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-xs text-white/50">Pro</div>
            <div className="mt-2 text-2xl font-semibold text-white">
              R$ 179<span className="text-sm font-medium text-white/60">/mes</span>
            </div>
            <p className="mt-2 text-sm text-white/65">Para operacao em crescimento.</p>
            <ul className="mt-4 grid gap-2 text-sm text-white/75">
              <li>Tudo do Equipe</li>
              <li>Mais usuarios e volume</li>
              <li>Relatorios avancados</li>
              <li>Suporte prioritario</li>
            </ul>
            <Link
              href="/register"
              className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
            >
              Falar sobre Pro
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 md:p-8">
          <div className="text-sm font-semibold text-white">Add-ons</div>
          <div className="mt-4 grid gap-3 text-sm text-white/75 md:grid-cols-3">
            <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
              <div className="font-semibold text-white">WhatsApp Oficial</div>
              <div className="mt-1 text-white/70">+R$ 49/mes por numero</div>
            </div>
            <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
              <div className="font-semibold text-white">Usuario extra</div>
              <div className="mt-1 text-white/70">+R$ 19/mes</div>
            </div>
            <div className="rounded-2xl bg-black/20 p-4 ring-1 ring-white/10">
              <div className="font-semibold text-white">Numero extra WhatsApp</div>
              <div className="mt-1 text-white/70">+R$ 39/mes</div>
            </div>
          </div>
          <p className="mt-4 text-xs text-white/55">
            Consumo de mensagens WhatsApp e cobrado no provedor oficial da conta do cliente (Meta/BSP).
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
            <div className="text-sm font-semibold">FAQ WhatsApp</div>
            <div className="mt-4 grid gap-4 text-sm text-white/70">
              <div>
                <div className="font-semibold text-white">WhatsApp Oficial ja esta incluso?</div>
                <div className="mt-1 text-white/60">Nao. E add-on opcional por numero.</div>
              </div>
              <div>
                <div className="font-semibold text-white">Posso usar meu proprio numero e conta?</div>
                <div className="mt-1 text-white/60">Sim. A conexao e feita na conta oficial do cliente.</div>
              </div>
              <div>
                <div className="font-semibold text-white">Quem paga as mensagens enviadas?</div>
                <div className="mt-1 text-white/60">O consumo e do cliente, direto no provedor oficial.</div>
              </div>
              <div>
                <div className="font-semibold text-white">Tem fidelidade?</div>
                <div className="mt-1 text-white/60">Nao. Cancelamento simples.</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-r from-emerald-400/15 via-white/5 to-amber-300/10 p-6 ring-1 ring-white/10">
            <div className="text-sm font-semibold text-white">Politica de cobranca</div>
            <ol className="mt-4 grid gap-3 text-sm text-white/70">
              <li>1. O plano cobre o uso da plataforma conforme recursos contratados.</li>
              <li>2. Add-on de WhatsApp Oficial e cobrado por numero conectado.</li>
              <li>3. Trafego de mensagens e cobrado separadamente no provedor oficial.</li>
              <li>4. Cliente mantem sua conta oficial ativa e regularizada.</li>
            </ol>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-300"
              >
                Criar conta
              </Link>
              <Link
                href={demoSiteHref}
                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
              >
                Ver demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}
