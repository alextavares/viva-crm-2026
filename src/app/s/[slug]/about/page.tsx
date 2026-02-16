import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getPublicSite } from "@/lib/public-site/site-data"
import { truncate, withBase } from "@/lib/public-site/seo"

export default async function PublicAboutPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const site = await getPublicSite(slug)
  if (!site) notFound()

  const page = site.pages.find((p) => p.key === "about") ?? null
  const title = page?.title || "Sobre"
  const content = page?.content || "Conteúdo não publicado."

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-3xl border bg-white/85 p-8 shadow-sm">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <div className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {content}
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

  const page = site.pages.find((p) => p.key === "about") ?? null
  const title = page?.title || "Sobre"
  const description = truncate(page?.content || `Conheça mais sobre ${site.settings?.brand_name || site.slug}.`)

  return withBase({
    title,
    description,
    alternates: { canonical: `/s/${site.slug}/about` },
    openGraph: { title, description, url: `/s/${site.slug}/about` },
  })
}
