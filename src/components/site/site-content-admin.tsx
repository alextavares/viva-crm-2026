"use client"

import { useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type OrgInfo = { id: string; name: string; slug: string }

type SiteNewsRow = {
  id: string
  organization_id: string
  title: string
  slug: string
  excerpt: string | null
  content: string
  is_published: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

type SiteLinkRow = {
  id: string
  organization_id: string
  title: string
  url: string
  description: string | null
  sort_order: number
  is_published: boolean
  created_at: string
  updated_at: string
}

type Props = {
  org: OrgInfo
  initial: {
    news: SiteNewsRow[]
    links: SiteLinkRow[]
  }
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function isHttpUrl(v: string) {
  return /^https?:\/\//i.test(v.trim())
}

function formatDate(v: string | null) {
  if (!v) return "—"
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d)
}

export function SiteContentAdmin({ org, initial }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [pending, setPending] = useState(false)
  const [news, setNews] = useState<SiteNewsRow[]>(initial.news)
  const [links, setLinks] = useState<SiteLinkRow[]>(initial.links)

  const [newNewsOpen, setNewNewsOpen] = useState(false)
  const [editNewsOpen, setEditNewsOpen] = useState(false)
  const [editingNews, setEditingNews] = useState<SiteNewsRow | null>(null)
  const [newNews, setNewNews] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
  })

  const [newLinkOpen, setNewLinkOpen] = useState(false)
  const [editLinkOpen, setEditLinkOpen] = useState(false)
  const [editingLink, setEditingLink] = useState<SiteLinkRow | null>(null)
  const [newLink, setNewLink] = useState({
    title: "",
    url: "",
    description: "",
    sort_order: String(links.length ? Math.max(...links.map((l) => l.sort_order)) + 1 : 0),
  })

  async function run(action: () => Promise<void>) {
    setPending(true)
    try {
      await action()
    } catch (error) {
      console.error(error)
      const msg =
        typeof error === "object" && error && "message" in error && typeof error.message === "string"
          ? error.message
          : "Erro ao salvar conteúdo do site."
      toast.error(msg)
    } finally {
      setPending(false)
    }
  }

  function ensureNewsInput(input: { title: string; slug: string; excerpt: string; content: string }) {
    const title = input.title.trim()
    const slug = (input.slug.trim() || slugify(title)).toLowerCase()
    const excerpt = input.excerpt.trim() || null
    const content = input.content.trim()

    if (!title) throw new Error("Título da notícia é obrigatório.")
    if (!slug) throw new Error("Slug inválido.")
    if (content.length < 50) throw new Error("Conteúdo da notícia deve ter pelo menos 50 caracteres.")

    return { title, slug, excerpt, content }
  }

  function ensureLinkInput(input: { title: string; url: string; description: string; sort_order: string }) {
    const title = input.title.trim()
    const url = input.url.trim()
    const description = input.description.trim() || null
    const sortOrder = Number(input.sort_order)

    if (!title) throw new Error("Título do link é obrigatório.")
    if (!isHttpUrl(url)) throw new Error("URL inválida. Use http:// ou https://")
    if (!Number.isFinite(sortOrder)) throw new Error("Ordem inválida.")

    return { title, url, description, sort_order: sortOrder }
  }

  async function createNews() {
    await run(async () => {
      const payload = ensureNewsInput(newNews)
      const { data, error } = await supabase
        .from("site_news")
        .insert({
          organization_id: org.id,
          title: payload.title,
          slug: payload.slug,
          excerpt: payload.excerpt,
          content: payload.content,
          is_published: false,
        })
        .select("*")
        .single()

      if (error) throw error
      setNews((prev) => [data as SiteNewsRow, ...prev])
      setNewNews({ title: "", slug: "", excerpt: "", content: "" })
      setNewNewsOpen(false)
      toast.success("Notícia criada.")
    })
  }

  async function saveNewsEdit() {
    if (!editingNews) return
    await run(async () => {
      const payload = ensureNewsInput({
        title: editingNews.title,
        slug: editingNews.slug,
        excerpt: editingNews.excerpt ?? "",
        content: editingNews.content,
      })
      const { data, error } = await supabase
        .from("site_news")
        .update({
          title: payload.title,
          slug: payload.slug,
          excerpt: payload.excerpt,
          content: payload.content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingNews.id)
        .select("*")
        .single()
      if (error) throw error
      setNews((prev) => prev.map((n) => (n.id === editingNews.id ? (data as SiteNewsRow) : n)))
      setEditingNews(null)
      setEditNewsOpen(false)
      toast.success("Notícia atualizada.")
    })
  }

  async function toggleNewsPublished(row: SiteNewsRow) {
    await run(async () => {
      const next = !row.is_published
      const { data, error } = await supabase
        .from("site_news")
        .update({
          is_published: next,
          published_at: next ? row.published_at ?? new Date().toISOString() : row.published_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single()
      if (error) throw error
      setNews((prev) => prev.map((n) => (n.id === row.id ? (data as SiteNewsRow) : n)))
      toast.success(next ? "Notícia publicada." : "Notícia despublicada.")
    })
  }

  async function deleteNews(id: string) {
    await run(async () => {
      const { error } = await supabase.from("site_news").delete().eq("id", id)
      if (error) throw error
      setNews((prev) => prev.filter((n) => n.id !== id))
      toast.success("Notícia excluída.")
    })
  }

  async function createLink() {
    await run(async () => {
      const payload = ensureLinkInput(newLink)
      const { data, error } = await supabase
        .from("site_links")
        .insert({
          organization_id: org.id,
          title: payload.title,
          url: payload.url,
          description: payload.description,
          sort_order: payload.sort_order,
          is_published: false,
        })
        .select("*")
        .single()
      if (error) throw error
      setLinks((prev) =>
        [...prev, data as SiteLinkRow].sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at))
      )
      setNewLink({
        title: "",
        url: "",
        description: "",
        sort_order: String(payload.sort_order + 1),
      })
      setNewLinkOpen(false)
      toast.success("Link criado.")
    })
  }

  async function saveLinkEdit() {
    if (!editingLink) return
    await run(async () => {
      const payload = ensureLinkInput({
        title: editingLink.title,
        url: editingLink.url,
        description: editingLink.description ?? "",
        sort_order: String(editingLink.sort_order),
      })
      const { data, error } = await supabase
        .from("site_links")
        .update({
          title: payload.title,
          url: payload.url,
          description: payload.description,
          sort_order: payload.sort_order,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingLink.id)
        .select("*")
        .single()
      if (error) throw error
      setLinks((prev) =>
        prev
          .map((l) => (l.id === editingLink.id ? (data as SiteLinkRow) : l))
          .sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at))
      )
      setEditingLink(null)
      setEditLinkOpen(false)
      toast.success("Link atualizado.")
    })
  }

  async function toggleLinkPublished(row: SiteLinkRow) {
    await run(async () => {
      const next = !row.is_published
      const { data, error } = await supabase
        .from("site_links")
        .update({
          is_published: next,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select("*")
        .single()
      if (error) throw error
      setLinks((prev) => prev.map((l) => (l.id === row.id ? (data as SiteLinkRow) : l)))
      toast.success(next ? "Link publicado." : "Link despublicado.")
    })
  }

  async function deleteLink(id: string) {
    await run(async () => {
      const { error } = await supabase.from("site_links").delete().eq("id", id)
      if (error) throw error
      setLinks((prev) => prev.filter((l) => l.id !== id))
      toast.success("Link excluído.")
    })
  }

  return (
    <div className="grid gap-6">
      <Card id="site-section-news">
        <CardHeader>
          <CardTitle>Notícias</CardTitle>
          <CardDescription>Publique conteúdo para SEO e autoridade no site da imobiliária.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex justify-end">
            <Dialog open={newNewsOpen} onOpenChange={setNewNewsOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Nova notícia</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar notícia</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label>Título</Label>
                    <Input
                      value={newNews.title}
                      onChange={(e) =>
                        setNewNews((prev) => ({ ...prev, title: e.target.value, slug: prev.slug || slugify(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Slug</Label>
                    <Input value={newNews.slug} onChange={(e) => setNewNews((prev) => ({ ...prev, slug: slugify(e.target.value) }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Resumo</Label>
                    <Textarea value={newNews.excerpt} onChange={(e) => setNewNews((prev) => ({ ...prev, excerpt: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Conteúdo</Label>
                    <Textarea
                      className="min-h-40"
                      value={newNews.content}
                      onChange={(e) => setNewNews((prev) => ({ ...prev, content: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewNewsOpen(false)} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button onClick={createNews} disabled={pending}>
                    {pending ? "Salvando..." : "Criar notícia"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {news.length === 0 ? (
            <div className="rounded-xl border bg-muted/10 p-4 text-sm text-muted-foreground">Nenhuma notícia cadastrada.</div>
          ) : (
            <div className="grid gap-3">
              {news.map((item) => (
                <div key={item.id} className="rounded-xl border bg-muted/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[240px]">
                      <div className="text-sm font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">/{item.slug}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.is_published ? `Publicado em ${formatDate(item.published_at)}` : "Rascunho"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleNewsPublished(item)} disabled={pending}>
                        {item.is_published ? "Despublicar" : "Publicar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingNews(item)
                          setEditNewsOpen(true)
                        }}
                        disabled={pending}
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteNews(item.id)} disabled={pending}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                  {item.excerpt ? <div className="mt-2 text-sm text-muted-foreground line-clamp-2">{item.excerpt}</div> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="site-section-links">
        <CardHeader>
          <CardTitle>Links úteis</CardTitle>
          <CardDescription>Lista de links externos para apoiar visitantes do seu site.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex justify-end">
            <Dialog open={newLinkOpen} onOpenChange={setNewLinkOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Novo link</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar link útil</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label>Título</Label>
                    <Input value={newLink.title} onChange={(e) => setNewLink((prev) => ({ ...prev, title: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>URL</Label>
                    <Input value={newLink.url} onChange={(e) => setNewLink((prev) => ({ ...prev, url: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div className="grid gap-2">
                    <Label>Descrição</Label>
                    <Textarea value={newLink.description} onChange={(e) => setNewLink((prev) => ({ ...prev, description: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Ordem</Label>
                    <Input value={newLink.sort_order} inputMode="numeric" onChange={(e) => setNewLink((prev) => ({ ...prev, sort_order: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewLinkOpen(false)} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button onClick={createLink} disabled={pending}>
                    {pending ? "Salvando..." : "Criar link"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {links.length === 0 ? (
            <div className="rounded-xl border bg-muted/10 p-4 text-sm text-muted-foreground">Nenhum link cadastrado.</div>
          ) : (
            <div className="grid gap-3">
              {links.map((item) => (
                <div key={item.id} className="rounded-xl border bg-muted/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-[240px]">
                      <div className="text-sm font-medium">{item.title}</div>
                      <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                        {item.url}
                      </a>
                      <div className="mt-1 text-xs text-muted-foreground">Ordem: {item.sort_order}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => toggleLinkPublished(item)} disabled={pending}>
                        {item.is_published ? "Despublicar" : "Publicar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingLink(item)
                          setEditLinkOpen(true)
                        }}
                        disabled={pending}
                      >
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteLink(item.id)} disabled={pending}>
                        Excluir
                      </Button>
                    </div>
                  </div>
                  {item.description ? <div className="mt-2 text-sm text-muted-foreground line-clamp-2">{item.description}</div> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editNewsOpen} onOpenChange={setEditNewsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar notícia</DialogTitle>
          </DialogHeader>
          {editingNews ? (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Título</Label>
                <Input
                  value={editingNews.title}
                  onChange={(e) => setEditingNews((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input
                  value={editingNews.slug}
                  onChange={(e) => setEditingNews((prev) => (prev ? { ...prev, slug: slugify(e.target.value) } : prev))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Resumo</Label>
                <Textarea
                  value={editingNews.excerpt ?? ""}
                  onChange={(e) => setEditingNews((prev) => (prev ? { ...prev, excerpt: e.target.value } : prev))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Conteúdo</Label>
                <Textarea
                  className="min-h-40"
                  value={editingNews.content}
                  onChange={(e) => setEditingNews((prev) => (prev ? { ...prev, content: e.target.value } : prev))}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNewsOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={saveNewsEdit} disabled={pending || !editingNews}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editLinkOpen} onOpenChange={setEditLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar link útil</DialogTitle>
          </DialogHeader>
          {editingLink ? (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label>Título</Label>
                <Input
                  value={editingLink.title}
                  onChange={(e) => setEditingLink((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                />
              </div>
              <div className="grid gap-2">
                <Label>URL</Label>
                <Input
                  value={editingLink.url}
                  onChange={(e) => setEditingLink((prev) => (prev ? { ...prev, url: e.target.value } : prev))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Descrição</Label>
                <Textarea
                  value={editingLink.description ?? ""}
                  onChange={(e) => setEditingLink((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                />
              </div>
              <div className="grid gap-2">
                <Label>Ordem</Label>
                <Input
                  inputMode="numeric"
                  value={String(editingLink.sort_order)}
                  onChange={(e) =>
                    setEditingLink((prev) => (prev ? { ...prev, sort_order: Number(e.target.value) || 0 } : prev))
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLinkOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={saveLinkEdit} disabled={pending || !editingLink}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
