"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  deleteSiteLink,
  deleteSiteNews,
  saveSiteLink,
  saveSiteNews,
  toggleSiteLinkPublished,
  toggleSiteNewsPublished,
} from "@/app/actions/site-content"
import type { ActionResult } from "@/lib/types"

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

function sortLinks(items: SiteLinkRow[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at))
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return "Erro ao salvar conteúdo do site."
}

export function SiteContentAdmin({ initial }: Props) {
  const router = useRouter()
  const [inFlight, setInFlight] = useState(0)
  const pending = inFlight > 0
  const [busyMsg, setBusyMsg] = useState<string | null>(null)
  const [sectionErrors, setSectionErrors] = useState<Record<string, string | null>>({})

  const [news, setNews] = useState<SiteNewsRow[]>(initial.news)
  const [links, setLinks] = useState<SiteLinkRow[]>(sortLinks(initial.links))

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

  const runAction = async <T,>(
    sectionKey: string,
    fn: () => Promise<ActionResult<T>>,
    successMessage: string,
    opts?: {
      busy?: string
      onSuccess?: (data: T | undefined) => void
      refresh?: boolean
    }
  ) => {
    setInFlight((c) => c + 1)
    setSectionErrors((prev) => ({ ...prev, [sectionKey]: null }))
    if (opts?.busy) setBusyMsg(opts.busy)

    try {
      const result = await fn()
      if (!result.success) {
        setSectionErrors((prev) => ({ ...prev, [sectionKey]: result.error }))
        toast.error(result.error)
        return false
      }

      opts?.onSuccess?.(result.data)
      toast.success(successMessage)
      if (opts?.refresh ?? true) {
        router.refresh()
      }
      return true
    } catch (error) {
      const message = getErrorMessage(error)
      console.error(`Error running ${sectionKey} action:`, error)
      setSectionErrors((prev) => ({ ...prev, [sectionKey]: message }))
      toast.error(message)
      return false
    } finally {
      setInFlight((c) => Math.max(0, c - 1))
      setBusyMsg((current) => (opts?.busy && current === opts.busy ? null : current))
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

  const createNews = async () => {
    try {
      const payload = ensureNewsInput(newNews)
      await runAction(
        "news",
        () => saveSiteNews(payload),
        "Notícia criada.",
        {
          busy: "Criando notícia...",
          onSuccess: (data) => {
            const created = (data as { news?: SiteNewsRow } | undefined)?.news
            if (created) {
              setNews((prev) => [created, ...prev])
            }
            setNewNews({ title: "", slug: "", excerpt: "", content: "" })
            setNewNewsOpen(false)
          },
        }
      )
    } catch (error) {
      const message = getErrorMessage(error)
      setSectionErrors((prev) => ({ ...prev, news: message }))
      toast.error(message)
    }
  }

  const saveNewsEdit = async () => {
    if (!editingNews) return

    try {
      const payload = ensureNewsInput({
        title: editingNews.title,
        slug: editingNews.slug,
        excerpt: editingNews.excerpt ?? "",
        content: editingNews.content,
      })

      await runAction(
        "editNews",
        () => saveSiteNews({ id: editingNews.id, ...payload }),
        "Notícia atualizada.",
        {
          busy: "Salvando notícia...",
          onSuccess: (data) => {
            const updated = (data as { news?: SiteNewsRow } | undefined)?.news
            if (updated) {
              setNews((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
            }
            setEditingNews(null)
            setEditNewsOpen(false)
          },
        }
      )
    } catch (error) {
      const message = getErrorMessage(error)
      setSectionErrors((prev) => ({ ...prev, editNews: message }))
      toast.error(message)
    }
  }

  const toggleNewsPublished = async (row: SiteNewsRow) => {
    await runAction(
      "news",
      () => toggleSiteNewsPublished({ id: row.id }),
      row.is_published ? "Notícia despublicada." : "Notícia publicada.",
      {
        busy: "Atualizando notícia...",
        onSuccess: (data) => {
          const updated = (data as { news?: SiteNewsRow } | undefined)?.news
          if (updated) {
            setNews((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
          }
        },
      }
    )
  }

  const deleteNews = async (id: string) => {
    await runAction(
      "news",
      () => deleteSiteNews({ id }),
      "Notícia excluída.",
      {
        busy: "Excluindo notícia...",
        onSuccess: () => {
          setNews((prev) => prev.filter((item) => item.id !== id))
        },
      }
    )
  }

  const createLink = async () => {
    try {
      const payload = ensureLinkInput(newLink)
      await runAction(
        "links",
        () =>
          saveSiteLink({
            title: payload.title,
            url: payload.url,
            description: payload.description,
            sortOrder: payload.sort_order,
          }),
        "Link criado.",
        {
          busy: "Criando link...",
          onSuccess: (data) => {
            const created = (data as { link?: SiteLinkRow } | undefined)?.link
            if (created) {
              setLinks((prev) => sortLinks([...prev, created]))
            }
            setNewLink({
              title: "",
              url: "",
              description: "",
              sort_order: String(payload.sort_order + 1),
            })
            setNewLinkOpen(false)
          },
        }
      )
    } catch (error) {
      const message = getErrorMessage(error)
      setSectionErrors((prev) => ({ ...prev, links: message }))
      toast.error(message)
    }
  }

  const saveLinkEdit = async () => {
    if (!editingLink) return

    try {
      const payload = ensureLinkInput({
        title: editingLink.title,
        url: editingLink.url,
        description: editingLink.description ?? "",
        sort_order: String(editingLink.sort_order),
      })

      await runAction(
        "editLink",
        () =>
          saveSiteLink({
            id: editingLink.id,
            title: payload.title,
            url: payload.url,
            description: payload.description,
            sortOrder: payload.sort_order,
          }),
        "Link atualizado.",
        {
          busy: "Salvando link...",
          onSuccess: (data) => {
            const updated = (data as { link?: SiteLinkRow } | undefined)?.link
            if (updated) {
              setLinks((prev) => sortLinks(prev.map((item) => (item.id === updated.id ? updated : item))))
            }
            setEditingLink(null)
            setEditLinkOpen(false)
          },
        }
      )
    } catch (error) {
      const message = getErrorMessage(error)
      setSectionErrors((prev) => ({ ...prev, editLink: message }))
      toast.error(message)
    }
  }

  const toggleLinkPublished = async (row: SiteLinkRow) => {
    await runAction(
      "links",
      () => toggleSiteLinkPublished({ id: row.id }),
      row.is_published ? "Link despublicado." : "Link publicado.",
      {
        busy: "Atualizando link...",
        onSuccess: (data) => {
          const updated = (data as { link?: SiteLinkRow } | undefined)?.link
          if (updated) {
            setLinks((prev) => sortLinks(prev.map((item) => (item.id === updated.id ? updated : item))))
          }
        },
      }
    )
  }

  const deleteLink = async (id: string) => {
    await runAction(
      "links",
      () => deleteSiteLink({ id }),
      "Link excluído.",
      {
        busy: "Excluindo link...",
        onSuccess: () => {
          setLinks((prev) => prev.filter((item) => item.id !== id))
        },
      }
    )
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
                    <Input
                      value={newNews.slug}
                      onChange={(e) => setNewNews((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Resumo</Label>
                    <Textarea
                      value={newNews.excerpt}
                      onChange={(e) => setNewNews((prev) => ({ ...prev, excerpt: e.target.value }))}
                    />
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
                    {pending ? busyMsg ?? "Processando..." : "Criar notícia"}
                  </Button>
                </DialogFooter>
                {sectionErrors.news ? <p className="text-sm text-red-600">{sectionErrors.news}</p> : null}
              </DialogContent>
            </Dialog>
          </div>

          {sectionErrors.news ? <p className="text-sm text-red-600">{sectionErrors.news}</p> : null}

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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" disabled={pending}>
                            Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir notícia?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A notícia será removida permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(event) => {
                                event.preventDefault()
                                void deleteNews(item.id)
                              }}
                              variant="destructive"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
                    <Input
                      value={newLink.url}
                      onChange={(e) => setNewLink((prev) => ({ ...prev, url: e.target.value }))}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={newLink.description}
                      onChange={(e) => setNewLink((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Ordem</Label>
                    <Input
                      value={newLink.sort_order}
                      inputMode="numeric"
                      onChange={(e) => setNewLink((prev) => ({ ...prev, sort_order: e.target.value }))}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewLinkOpen(false)} disabled={pending}>
                    Cancelar
                  </Button>
                  <Button onClick={createLink} disabled={pending}>
                    {pending ? busyMsg ?? "Processando..." : "Criar link"}
                  </Button>
                </DialogFooter>
                {sectionErrors.links ? <p className="text-sm text-red-600">{sectionErrors.links}</p> : null}
              </DialogContent>
            </Dialog>
          </div>

          {sectionErrors.links ? <p className="text-sm text-red-600">{sectionErrors.links}</p> : null}

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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" disabled={pending}>
                            Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir link útil?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O link será removido permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(event) => {
                                event.preventDefault()
                                void deleteLink(item.id)
                              }}
                              variant="destructive"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
              {pending ? busyMsg ?? "Processando..." : "Salvar"}
            </Button>
          </DialogFooter>
          {sectionErrors.editNews ? <p className="text-sm text-red-600">{sectionErrors.editNews}</p> : null}
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
              {pending ? busyMsg ?? "Processando..." : "Salvar"}
            </Button>
          </DialogFooter>
          {sectionErrors.editLink ? <p className="text-sm text-red-600">{sectionErrors.editLink}</p> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
