import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getPublicSite } from "@/lib/public-site/site-data"
import { truncate, withBase } from "@/lib/public-site/seo"
import { SiteLeadForm } from "@/components/public/site-lead-form"

function digitsOnly(s: string) {
  return s.replace(/[^0-9]/g, "")
}

export default async function PublicContactPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const site = await getPublicSite(slug)
  if (!site) notFound()

  const page = site.pages.find((p) => p.key === "contact") ?? null
  const title = page?.title || "Contato"
  const content = page?.content || "Use os canais abaixo para falar com a equipe."

  const whatsapp = site.settings?.whatsapp ? digitsOnly(site.settings.whatsapp) : null

  return (
    <main className="mx-auto max-w-6xl px-4 py-7 sm:py-10">
      <section className="rounded-3xl border bg-white/85 p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 md:gap-8 md:grid-cols-2 md:items-start">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {content}
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Sua mensagem entra direto no CRM da imobiliária/corretor responsável.
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                className="inline-flex rounded-2xl border bg-white px-5 py-2.5 text-sm font-semibold"
                href="#enviar-mensagem"
              >
                Enviar mensagem ↓
              </a>
            </div>

            <div className="mt-3 text-xs text-muted-foreground md:hidden">
              Sem WhatsApp agora? O formulário está logo abaixo.
            </div>
          </div>

          <div
            id="enviar-mensagem"
            className="scroll-mt-24 rounded-3xl border bg-white p-6 shadow-sm"
          >
            <div className="text-base font-semibold">Envie uma mensagem</div>
            <div className="mt-2 text-xs text-muted-foreground">
              Nome e WhatsApp são obrigatórios. Mensagem é opcional. A resposta chega pelo contato informado.
            </div>
            <div className="mt-4">
              <SiteLeadForm siteSlug={site.slug} propertyId={null} />
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          <div className="rounded-3xl border bg-white p-5">
            <div className="text-sm font-medium">WhatsApp</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {whatsapp ? whatsapp : "Não configurado"}
            </div>
          </div>

          <div className="rounded-3xl border bg-white p-5">
            <div className="text-sm font-medium">E-mail</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {site.settings?.email || "Não configurado"}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const site = await getPublicSite(slug)
  if (!site) return withBase({ title: "Site não encontrado" })

  const page = site.pages.find((p) => p.key === "contact") ?? null
  const title = page?.title || "Contato"
  const description = truncate(page?.content || `Fale com ${site.settings?.brand_name || site.slug} e envie sua mensagem direto para o CRM.`)

  return withBase({
    title,
    description,
    alternates: { canonical: `/s/${site.slug}/contact` },
    openGraph: { title, description, url: `/s/${site.slug}/contact` },
  })
}
