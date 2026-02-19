import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getPublicNews, getPublicSite } from "@/lib/public-site/site-data"
import { truncate, withBase } from "@/lib/public-site/seo"
import { getRequestHost, publicBasePath } from "@/lib/public-site/host"

function formatDatePt(v: string | null | undefined) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(d)
}

export default async function PublicNewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string; newsSlug: string }>
}) {
  const { slug, newsSlug } = await params
  const [site, news, host] = await Promise.all([
    getPublicSite(slug),
    getPublicNews(slug, newsSlug),
    getRequestHost(),
  ])
  if (!site || !news) notFound()

  const base = publicBasePath(site.slug, host)
  const homeHref = base || "/"
  const listHref = `${homeHref === "/" ? "" : homeHref}/noticias`

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <article className="rounded-3xl border bg-white/85 p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href={listHref} className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar para notícias
          </Link>
          <div className="text-xs text-muted-foreground">
            {formatDatePt(news.published_at || news.created_at) || "Publicação recente"}
          </div>
        </div>
        <h1 className="text-3xl font-semibold leading-tight">{news.title}</h1>
        {news.excerpt ? (
          <p className="mt-4 text-base text-muted-foreground">{news.excerpt}</p>
        ) : null}
        <div className="mt-8 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
          {news.content || "Conteúdo indisponível."}
        </div>
      </article>
    </main>
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; newsSlug: string }>
}): Promise<Metadata> {
  const { slug, newsSlug } = await params
  const [site, news] = await Promise.all([getPublicSite(slug), getPublicNews(slug, newsSlug)])
  if (!site || !news) return withBase({ title: "Notícia não encontrada" })

  const description = truncate(news.excerpt || news.content || `Notícia de ${site.settings?.brand_name || site.slug}.`)

  return withBase({
    title: news.title,
    description,
    alternates: { canonical: `/s/${site.slug}/noticias/${news.slug}` },
    openGraph: { title: news.title, description, url: `/s/${site.slug}/noticias/${news.slug}` },
  })
}

