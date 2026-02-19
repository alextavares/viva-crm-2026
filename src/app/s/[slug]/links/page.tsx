import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getPublicLinks, getPublicSite } from "@/lib/public-site/site-data"
import { truncate, withBase } from "@/lib/public-site/seo"
import { getRequestHost, publicBasePath } from "@/lib/public-site/host"

export default async function PublicLinksPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [site, links, host] = await Promise.all([
    getPublicSite(slug),
    getPublicLinks(slug),
    getRequestHost(),
  ])
  if (!site) notFound()

  const base = publicBasePath(site.slug, host)
  const homeHref = base || "/"

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl border bg-white/85 p-8 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-3xl font-semibold">Links úteis</h1>
          <Link href={homeHref} className="text-sm text-muted-foreground hover:text-foreground">
            Voltar para imóveis
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Serviços e referências recomendadas por {site.settings?.brand_name || site.slug}.
        </p>

        {links.length === 0 ? (
          <div className="mt-6 rounded-2xl border bg-white p-5 text-sm text-muted-foreground">
            Nenhum link útil publicado no momento.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {links.map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border bg-white p-5 transition-shadow hover:shadow-sm"
              >
                <div className="text-base font-semibold">{item.title}</div>
                {item.description ? (
                  <div className="mt-2 text-sm text-muted-foreground">{item.description}</div>
                ) : null}
                <div className="mt-3 text-xs text-muted-foreground">{item.url}</div>
              </a>
            ))}
          </div>
        )}
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

  const title = "Links úteis"
  const description = truncate(`Links úteis e serviços recomendados por ${site.settings?.brand_name || site.slug}.`)

  return withBase({
    title,
    description,
    alternates: { canonical: `/s/${site.slug}/links` },
    openGraph: { title, description, url: `/s/${site.slug}/links` },
  })
}

