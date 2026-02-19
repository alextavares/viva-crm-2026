import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getPublicNewsList, getPublicSite } from "@/lib/public-site/site-data"
import { truncate, withBase } from "@/lib/public-site/seo"
import { getRequestHost, publicBasePath } from "@/lib/public-site/host"

function formatDatePt(v: string | null | undefined) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(d)
}

export default async function PublicNewsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [site, news, host] = await Promise.all([
    getPublicSite(slug),
    getPublicNewsList(slug, 24, 0),
    getRequestHost(),
  ])
  if (!site) notFound()

  const base = publicBasePath(site.slug, host)
  const homeHref = base || "/"

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl border bg-white/85 p-8 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-3xl font-semibold">Notícias</h1>
          <Link href={homeHref} className="text-sm text-muted-foreground hover:text-foreground">
            Voltar para imóveis
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Conteúdos e novidades publicados por {site.settings?.brand_name || site.slug}.
        </p>

        {news.length === 0 ? (
          <div className="mt-6 rounded-2xl border bg-white p-5 text-sm text-muted-foreground">
            Nenhuma notícia publicada no momento.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {news.map((item) => (
              <Link
                key={item.id}
                href={`${homeHref === "/" ? "" : homeHref}/noticias/${item.slug}`}
                className="rounded-2xl border bg-white p-5 transition-shadow hover:shadow-sm"
              >
                <div className="text-xs text-muted-foreground">
                  {formatDatePt(item.published_at || item.created_at) || "Publicação recente"}
                </div>
                <div className="mt-2 text-lg font-semibold">{item.title}</div>
                <div className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {item.excerpt || "Leia o conteúdo completo desta notícia."}
                </div>
              </Link>
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

  const title = "Notícias"
  const description = truncate(`Notícias e conteúdos de ${site.settings?.brand_name || site.slug}.`)

  return withBase({
    title,
    description,
    alternates: { canonical: `/s/${site.slug}/noticias` },
    openGraph: { title, description, url: `/s/${site.slug}/noticias` },
  })
}

