"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { CheckCircle2, Circle } from "lucide-react"

type OrgInfo = { id: string; name: string; slug: string }

type SiteSettingsRow = {
  organization_id: string
  theme: "search_first" | "premium"
  brand_name: string | null
  logo_url: string | null
  primary_color: string | null
  secondary_color: string | null
  whatsapp: string | null
  phone: string | null
  email: string | null
}

type SitePageKey = "about" | "contact" | "lgpd"

type SitePageRow = {
  id: string
  key: SitePageKey
  title: string | null
  content: string | null
  is_published: boolean
}

type BannerPlacement = "topbar" | "popup" | "hero" | "footer"

type SiteBannerRow = {
  id: string
  placement: BannerPlacement
  title: string | null
  body: string | null
  image_url: string | null
  link_url: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  priority: number
}

type CustomDomainStatus = "pending" | "verified" | "error"

type CustomDomainRow = {
  organization_id: string
  domain: string
  status: CustomDomainStatus
  last_checked_at: string | null
  last_error: string | null
}

type Props = {
  org: OrgInfo
  previewUrl?: string
  checklist?: {
    hasPublicProperty: boolean
  }
  initial: {
    settings: SiteSettingsRow | null
    pages: Array<Record<string, unknown>>
    banners: Array<Record<string, unknown>>
    domain?: Record<string, unknown> | null
  }
}

function isAbortError(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name?: unknown }).name === "AbortError"
  )
}

function isAbortLikeError(err: unknown) {
  if (isAbortError(err)) return true
  if (typeof err === "object" && err !== null) {
    const msg = "message" in err ? (err as { message?: unknown }).message : undefined
    if (typeof msg === "string" && msg.includes("AbortError")) return true
  }
  return false
}

function isSupabaseAbortNoise(err: unknown) {
  if (!err || typeof err !== "object") return false
  const e = err as { name?: unknown; message?: unknown; cause?: unknown }
  const name = typeof e.name === "string" ? e.name : ""
  const msg = typeof e.message === "string" ? e.message : ""
  const cause = e.cause as { name?: unknown; message?: unknown } | undefined
  const causeName = typeof cause?.name === "string" ? cause?.name : ""
  const causeMsg = typeof cause?.message === "string" ? cause?.message : ""

  const aborted = msg.includes("signal is aborted") || causeMsg.includes("signal is aborted")
  if (!aborted) return false

  return (
    name === "AbortError" ||
    name === "StorageUnknownError" ||
    name === "AuthRetryableFetchError" ||
    causeName === "AbortError"
  )
}

function getErrorMessage(err: unknown): string | null {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message?: unknown }).message
    if (typeof msg === "string" && msg.trim()) return msg
  }
  if (err instanceof Error && err.message.trim()) return err.message
  return null
}

function humanizeSupabaseError(err: unknown): string {
  const msg = getErrorMessage(err) ?? ""

  // RLS / permissions
  if (/row level security|row-level security|permission denied|not allowed/i.test(msg)) {
    return "Sem permissão para salvar. Entre com um usuário owner/manager desta organização."
  }

  // Missing column / schema mismatch (common when migrations weren't applied)
  if (/column .* does not exist/i.test(msg)) {
    return `Seu banco parece desatualizado: ${msg}`
  }

  // Fallback to raw message when available (useful for debugging)
  if (msg) return msg
  return "Não foi possível salvar. Tente novamente."
}

function asPageRow(v: Record<string, unknown>): SitePageRow | null {
  const id = typeof v.id === "string" ? v.id : null
  const key = v.key === "about" || v.key === "contact" || v.key === "lgpd" ? (v.key as SitePageKey) : null
  if (!id || !key) return null
  return {
    id,
    key,
    title: typeof v.title === "string" ? v.title : v.title == null ? null : String(v.title),
    content: typeof v.content === "string" ? v.content : v.content == null ? null : String(v.content),
    is_published: Boolean(v.is_published),
  }
}

function asBannerRow(v: Record<string, unknown>): SiteBannerRow | null {
  const id = typeof v.id === "string" ? v.id : null
  const placement =
    v.placement === "topbar" || v.placement === "popup" || v.placement === "hero" || v.placement === "footer"
      ? (v.placement as BannerPlacement)
      : null
  if (!id || !placement) return null
  return {
    id,
    placement,
    title: typeof v.title === "string" ? v.title : v.title == null ? null : String(v.title),
    body: typeof v.body === "string" ? v.body : v.body == null ? null : String(v.body),
    image_url: typeof v.image_url === "string" ? v.image_url : v.image_url == null ? null : String(v.image_url),
    link_url: typeof v.link_url === "string" ? v.link_url : v.link_url == null ? null : String(v.link_url),
    starts_at: typeof v.starts_at === "string" ? v.starts_at : v.starts_at == null ? null : String(v.starts_at),
    ends_at: typeof v.ends_at === "string" ? v.ends_at : v.ends_at == null ? null : String(v.ends_at),
    is_active: Boolean(v.is_active),
    priority: typeof v.priority === "number" ? v.priority : Number(v.priority ?? 0),
  }
}

function asDomainRow(v: Record<string, unknown> | null | undefined): CustomDomainRow | null {
  if (!v) return null
  const orgId = typeof v.organization_id === "string" ? v.organization_id : null
  const domain = typeof v.domain === "string" ? v.domain : null
  const status =
    v.status === "pending" || v.status === "verified" || v.status === "error"
      ? (v.status as CustomDomainStatus)
      : "pending"
  if (!orgId || !domain) return null
  return {
    organization_id: orgId,
    domain,
    status,
    last_checked_at: typeof v.last_checked_at === "string" ? v.last_checked_at : null,
    last_error: typeof v.last_error === "string" ? v.last_error : v.last_error == null ? null : String(v.last_error),
  }
}

function ensureDefaultPages(existing: SitePageRow[]): SitePageRow[] {
  const byKey = new Map(existing.map((p) => [p.key, p]))
  const mk = (key: SitePageKey, title: string): SitePageRow => ({
    id: `__new__${key}`,
    key,
    title,
    content: "",
    is_published: true,
  })
  return [
    byKey.get("about") ?? mk("about", "Sobre"),
    byKey.get("contact") ?? mk("contact", "Contato"),
    byKey.get("lgpd") ?? mk("lgpd", "LGPD"),
  ]
}

function nowIso() {
  return new Date().toISOString()
}

async function uploadSiteAsset(
  supabase: SupabaseClient,
  opts: { orgId: string; file: File; kind: "logo" | "banner" }
): Promise<string> {
  const ext = opts.file.name.split(".").pop() || "png"
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "png"
  const fileName = `${opts.kind}-${crypto.randomUUID()}.${safeExt}`
  const path = `org/${opts.orgId}/site/${fileName}`

  const { error } = await supabase.storage.from("site-assets").upload(path, opts.file, {
    upsert: true,
    cacheControl: "3600",
  })
  if (error) throw error

  const { data } = supabase.storage.from("site-assets").getPublicUrl(path)
  if (!data?.publicUrl) throw new Error("Não foi possível obter URL pública do arquivo.")
  return data.publicUrl
}

export function SiteAdmin({ org, initial, previewUrl, checklist }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [inFlight, setInFlight] = useState(0)
  const pending = inFlight > 0
  const [busyMsg, setBusyMsg] = useState<string | null>(null)

  useEffect(() => {
    // Safety net: never keep the UI stuck on an old busy message when no operations are running.
    if (inFlight === 0) setBusyMsg(null)
  }, [inFlight])

  const runPlain = async (
    fn: () => Promise<void>,
    errorMessage: string,
    opts?: { busy?: string; timeoutMs?: number }
  ) => {
    setInFlight((c) => c + 1)
    if (opts?.busy) setBusyMsg(opts.busy)
    const timeoutMs = opts?.timeoutMs ?? 60000
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error("timeout")), timeoutMs)
    })

    try {
      await Promise.race([fn(), timeoutPromise])
    } catch (err) {
      if (err instanceof Error && err.message === "timeout") {
        toast.error("Demorou demais para salvar. Tente novamente.")
        return
      }
      if (isSupabaseAbortNoise(err) || isAbortLikeError(err)) {
        // Ignore noisy abort-like errors (common in dev lock races).
        return
      }
      console.error(errorMessage, err)
      toast.error(humanizeSupabaseError(err))
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      setInFlight((c) => Math.max(0, c - 1))
      setBusyMsg((m) => (opts?.busy && m === opts.busy ? null : m))
    }
  }

  const run = async (
    fn: (signal: AbortSignal) => Promise<void>,
    errorMessage: string,
    opts?: { busy?: string; timeoutMs?: number }
  ) => {
    setInFlight((c) => c + 1)
    if (opts?.busy) setBusyMsg(opts.busy)
    const ac = new AbortController()
    const timeoutMs = opts?.timeoutMs ?? 30000
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        try {
          ac.abort()
        } catch {
          // ignore
        }
        reject(new Error("timeout"))
      }, timeoutMs)
    })
    try {
      await Promise.race([fn(ac.signal), timeoutPromise])
    } catch (err) {
      if (err instanceof Error && err.message === "timeout") {
        toast.error("Demorou demais para salvar. Tente novamente.")
        return
      }
      if (ac.signal.aborted || isAbortLikeError(err)) {
        toast.error("Demorou demais para salvar. Tente novamente.")
        return
      }
      console.error(errorMessage, err)
      toast.error(humanizeSupabaseError(err))
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      setInFlight((c) => Math.max(0, c - 1))
      setBusyMsg((m) => (opts?.busy && m === opts.busy ? null : m))
    }
  }

  const [settings, setSettings] = useState<SiteSettingsRow>(() => {
    const s = initial.settings
    return {
      organization_id: org.id,
      theme: (s?.theme as SiteSettingsRow["theme"]) ?? "search_first",
      brand_name: s?.brand_name ?? org.name,
      logo_url: s?.logo_url ?? null,
      primary_color: s?.primary_color ?? "#0b1220",
      secondary_color: s?.secondary_color ?? "#22c55e",
      whatsapp: s?.whatsapp ?? "",
      phone: s?.phone ?? "",
      email: s?.email ?? "",
    }
  })

  const [pages, setPages] = useState<SitePageRow[]>(() => {
    const parsed = initial.pages.map(asPageRow).filter(Boolean) as SitePageRow[]
    return ensureDefaultPages(parsed)
  })

  const [banners, setBanners] = useState<SiteBannerRow[]>(() => {
    return initial.banners.map(asBannerRow).filter(Boolean) as SiteBannerRow[]
  })

  const [domainRow, setDomainRow] = useState<CustomDomainRow | null>(() => asDomainRow(initial.domain ?? null))
  const [domainInput, setDomainInput] = useState<string>(() => (domainRow?.domain ?? "").toString())

  const [newBannerOpen, setNewBannerOpen] = useState(false)
  const [newBanner, setNewBanner] = useState<Omit<SiteBannerRow, "id">>({
    placement: "topbar",
    title: "",
    body: "",
    image_url: "",
    link_url: "",
    starts_at: "",
    ends_at: "",
    is_active: true,
    priority: 10,
  })

  const [editBannerOpen, setEditBannerOpen] = useState(false)
  const [editBannerId, setEditBannerId] = useState<string | null>(null)
  const [editBanner, setEditBanner] = useState<Omit<SiteBannerRow, "id"> | null>(null)

  const siteHref = `/s/${org.slug}`
  const previewHref = previewUrl || `http://${org.slug}.lvh.me:3015`
  const canSaveSettings = settings.brand_name?.trim() && settings.whatsapp?.trim() && settings.email?.trim()
  const hasRequiredContact = Boolean(settings.whatsapp?.trim() && settings.email?.trim() && settings.brand_name?.trim())
  const isDomainVerified = domainRow?.status === "verified"
  const hasPublicProperty = Boolean(checklist?.hasPublicProperty)

  useEffect(() => {
    // Keep slot in case we later sync live preview.
  }, [])

  const saveSettings = () => {
    if (!canSaveSettings) {
      toast.error("Preencha Nome da marca, WhatsApp e E-mail.")
      return
    }

    void run(async (signal) => {
      const payload = {
        ...settings,
        brand_name: settings.brand_name?.trim() || null,
        logo_url: settings.logo_url?.trim() || null,
        primary_color: settings.primary_color?.trim() || null,
        secondary_color: settings.secondary_color?.trim() || null,
        whatsapp: settings.whatsapp?.trim() || null,
        phone: settings.phone?.trim() || null,
        email: settings.email?.trim() || null,
        updated_at: nowIso(),
      }

      const { error } = await supabase.from("site_settings").upsert(payload).abortSignal(signal)
      if (error) throw error

      toast.success("Configurações do site salvas.")
    }, "Error saving site_settings:", { busy: "Salvando configurações..." })
  }

  const normalizeDomain = (raw: string) => {
    const s = raw.trim().toLowerCase()
    const noScheme = s.replace(/^https?:\/\//, "")
    const noPath = noScheme.split("/")[0]
    const noPort = noPath.split(":")[0]
    return noPort.replace(/\.$/, "")
  }

  const saveDomain = () => {
    const domain = normalizeDomain(domainInput)
    if (!domain) {
      toast.error("Informe um domínio (ex.: www.seudominio.com.br).")
      return
    }
    if (!domain.startsWith("www.")) {
      toast.error("No MVP, use um domínio começando com www. (ex.: www.seudominio.com.br).")
      return
    }

    void run(async (signal) => {
      const payload = {
        organization_id: org.id,
        domain,
        status: "pending" as const,
        last_error: null,
        updated_at: nowIso(),
      }
      const { data, error } = await supabase
        .from("custom_domains")
        .upsert(payload)
        .select("*")
        .single()
        .abortSignal(signal)
      if (error) throw error
      const parsed = asDomainRow(data as unknown as Record<string, unknown>)
      setDomainRow(parsed)
      if (parsed) setDomainInput(parsed.domain)
      toast.success("Domínio salvo. Agora configure o CNAME e clique em Verificar.")
    }, "Error saving custom_domains:", { busy: "Salvando domínio..." })
  }

  const verifyDomain = () => {
    void runPlain(async () => {
      const res = await fetch("/api/site/verify-domain", { method: "POST" })
      const data = (await res.json()) as { ok?: boolean; message?: string; domain?: string }
      if (!data.ok) {
        toast.error(data.message || "Não foi possível verificar.")
        // Reload row to reflect error state (if any).
        const { data: row } = await supabase
          .from("custom_domains")
          .select("*")
          .eq("organization_id", org.id)
          .maybeSingle()
        setDomainRow(asDomainRow((row ?? null) as unknown as Record<string, unknown> | null))
        return
      }
      toast.success(data.message || "Domínio verificado.")
      const { data: row } = await supabase
        .from("custom_domains")
        .select("*")
        .eq("organization_id", org.id)
        .maybeSingle()
      setDomainRow(asDomainRow((row ?? null) as unknown as Record<string, unknown> | null))
    }, "Error verifying domain:", { busy: "Verificando DNS...", timeoutMs: 60000 })
  }

  const uploadLogo = async (file: File) => {
    await runPlain(async () => {
      const url = await uploadSiteAsset(supabase, { orgId: org.id, file, kind: "logo" })
      setSettings((s) => ({ ...s, logo_url: url }))
      toast.success("Logo enviado. Clique em Salvar para aplicar.")
    }, "Logo upload failed:", { busy: "Enviando logo...", timeoutMs: 180000 })
  }

  const savePages = () => {
    void run(async (signal) => {
      const rows = pages.map((p) => ({
        organization_id: org.id,
        key: p.key,
        title: p.title?.trim() || null,
        content: p.content?.trim() || null,
        is_published: Boolean(p.is_published),
        updated_at: nowIso(),
      }))

      const { error } = await supabase
        .from("site_pages")
        .upsert(rows, { onConflict: "organization_id,key" })
        .abortSignal(signal)
      if (error) throw error

      toast.success("Páginas salvas.")
    }, "Error saving site_pages:", { busy: "Salvando páginas..." })
  }

  const createBanner = () => {
    void run(async (signal) => {
      const payload = {
        organization_id: org.id,
        placement: newBanner.placement,
        title: newBanner.title?.trim() || null,
        body: newBanner.body?.trim() || null,
        image_url: newBanner.image_url?.trim() || null,
        link_url: newBanner.link_url?.trim() || null,
        starts_at: newBanner.starts_at?.trim() || null,
        ends_at: newBanner.ends_at?.trim() || null,
        is_active: Boolean(newBanner.is_active),
        priority: Number.isFinite(newBanner.priority) ? newBanner.priority : 0,
        updated_at: nowIso(),
      }

      const { data, error } = await supabase
        .from("site_banners")
        .insert(payload)
        .select("*")
        .single()
        .abortSignal(signal)
      if (error) throw error

      const created = asBannerRow(data as unknown as Record<string, unknown>)
      if (created) setBanners((prev) => [created, ...prev])

      setNewBannerOpen(false)
      setNewBanner({
        placement: "topbar",
        title: "",
        body: "",
        image_url: "",
        link_url: "",
        starts_at: "",
        ends_at: "",
        is_active: true,
        priority: 10,
      })
      toast.success("Banner criado.")
    }, "Error creating banner:", { busy: "Criando banner..." })
  }

  const deleteBanner = (id: string) => {
    void run(async (signal) => {
      const { error } = await supabase.from("site_banners").delete().eq("id", id).abortSignal(signal)
      if (error) throw error
      setBanners((prev) => prev.filter((b) => b.id !== id))
      toast.success("Banner excluído.")
    }, "Error deleting banner:", { busy: "Excluindo banner..." })
  }

  const openEditBanner = (b: SiteBannerRow) => {
    setEditBannerId(b.id)
    setEditBanner({
      placement: b.placement,
      title: b.title ?? "",
      body: b.body ?? "",
      image_url: b.image_url ?? "",
      link_url: b.link_url ?? "",
      starts_at: b.starts_at ?? "",
      ends_at: b.ends_at ?? "",
      is_active: Boolean(b.is_active),
      priority: b.priority ?? 0,
    })
    setEditBannerOpen(true)
  }

  const saveEditBanner = () => {
    if (!editBannerId || !editBanner) return

    void run(async (signal) => {
      const payload = {
        placement: editBanner.placement,
        title: editBanner.title?.trim() || null,
        body: editBanner.body?.trim() || null,
        image_url: editBanner.image_url?.trim() || null,
        link_url: editBanner.link_url?.trim() || null,
        starts_at: editBanner.starts_at?.trim() || null,
        ends_at: editBanner.ends_at?.trim() || null,
        is_active: Boolean(editBanner.is_active),
        priority: Number.isFinite(editBanner.priority) ? editBanner.priority : 0,
        updated_at: nowIso(),
      }

      const { data, error } = await supabase
        .from("site_banners")
        .update(payload)
        .eq("id", editBannerId)
        .select("*")
        .single()
        .abortSignal(signal)
      if (error) throw error

      const updated = asBannerRow(data as unknown as Record<string, unknown>)
      if (updated) setBanners((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))

      setEditBannerOpen(false)
      setEditBannerId(null)
      setEditBanner(null)
      toast.success("Banner atualizado.")
    }, "Error updating banner:", { busy: "Salvando banner..." })
  }

  const uploadEditBannerImage = async (file: File) => {
    await runPlain(async () => {
      const url = await uploadSiteAsset(supabase, { orgId: org.id, file, kind: "banner" })
      setEditBanner((b) => (b ? { ...b, image_url: url } : b))
      toast.success("Imagem enviada. Salve o banner para aplicar.")
    }, "Edit banner upload failed:", { busy: "Enviando imagem...", timeoutMs: 180000 })
  }

  const uploadBannerImage = async (file: File) => {
    await runPlain(async () => {
      const url = await uploadSiteAsset(supabase, { orgId: org.id, file, kind: "banner" })
      setNewBanner((b) => ({ ...b, image_url: url }))
      toast.success("Imagem enviada. Salve o banner para aplicar.")
    }, "Banner upload failed:", { busy: "Enviando imagem...", timeoutMs: 180000 })
  }

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(`${label} copiado.`)
    } catch {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}.`)
    }
  }

  return (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold md:text-3xl">Site Público</h1>
              <p className="text-muted-foreground">
                Configure marca, páginas e banners. Prévia:{" "}
                <Link className="underline underline-offset-4" href={siteHref} target="_blank" rel="noreferrer">
                  {siteHref}
                </Link>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void copyText(previewHref, "Link de preview")} disabled={pending}>
                  Copiar link de preview
                </Button>
                <a
                  className="text-xs text-muted-foreground underline underline-offset-4"
                  href={previewHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  {previewHref}
                </a>
              </div>
              {pending && busyMsg ? (
                <p className="mt-1 text-sm text-muted-foreground">{busyMsg}</p>
              ) : null}
            </div>
            <Link href="/settings">
              <Button variant="outline">Voltar</Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Checklist de publicação</CardTitle>
              <CardDescription>Antes de divulgar o link do site, confirme estes itens.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {[
                {
                  done: hasRequiredContact,
                  title: "Marca + WhatsApp + E-mail configurados",
                  hint: "Necessário para captar e responder leads.",
                },
                {
                  done: hasPublicProperty,
                  title: "Existe pelo menos 1 imóvel visível no site",
                  hint: "Use Publicar em massa ou o toggle na lista de imóveis.",
                },
                {
                  done: isDomainVerified,
                  title: "Domínio próprio verificado (DNS)",
                  hint: "Opcional no início, recomendado para go-live.",
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-xl border bg-muted/10 p-3">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.hint}</div>
                  </div>
                </div>
              ))}
              <div className="mt-1 flex flex-wrap gap-2">
                <Link href="/properties/publish">
                  <Button variant="outline" size="sm">Publicar em massa</Button>
                </Link>
                <Link href="/properties" target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">Abrir imóveis</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Marca e Contato</CardTitle>
              <CardDescription>
                Nome da marca, cores e canais de contato. Logo é opcional.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nome da marca (obrigatório)</Label>
                  <Input
                    value={settings.brand_name ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, brand_name: e.target.value }))}
                    placeholder="Ex: Riviera Imóveis"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tema</Label>
                  <Select
                    value={settings.theme}
                    onValueChange={(v) => setSettings((s) => ({ ...s, theme: v as SiteSettingsRow["theme"] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="search_first">search_first</SelectItem>
                      <SelectItem value="premium">premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>WhatsApp (obrigatório)</Label>
                  <Input
                    value={settings.whatsapp ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, whatsapp: e.target.value }))}
                    placeholder="Ex: +55 (11) 99999-9999"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>E-mail (obrigatório)</Label>
                  <Input
                    value={settings.email ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, email: e.target.value }))}
                    placeholder="Ex: contato@seudominio.com.br"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Telefone (opcional)</Label>
                  <Input
                    value={settings.phone ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, phone: e.target.value }))}
                    placeholder="Ex: (11) 3000-0000"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Cor primária</Label>
                  <Input
                    value={settings.primary_color ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, primary_color: e.target.value }))}
                    placeholder="#0b1220"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Cor secundária</Label>
                  <Input
                    value={settings.secondary_color ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, secondary_color: e.target.value }))}
                    placeholder="#22c55e"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Logo (opcional)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={pending}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      e.target.value = ""
                      if (f) void uploadLogo(f)
                    }}
                  />
                  {settings.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.logo_url} alt="Logo" className="mt-2 h-10 w-auto rounded bg-white p-1 border" />
                  ) : (
                    <div className="text-xs text-muted-foreground">Sem logo por enquanto.</div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button onClick={saveSettings} disabled={pending}>
                  {pending ? busyMsg ?? "Processando..." : "Salvar configurações"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Domínio próprio</CardTitle>
              <CardDescription>
                No MVP, suportamos apenas domínio com <span className="font-medium">www</span>. O domínio sem www deve redirecionar para o www no seu provedor.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Domínio (www)</Label>
                <Input
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="www.seudominio.com.br"
                  disabled={pending}
                />
                <div className="text-xs text-muted-foreground">
                  Crie um registro <span className="font-medium">CNAME</span>: <span className="font-mono">www</span> → <span className="font-mono">sites.vivacrm.com.br</span>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <div className="font-medium">Status</div>
                <div className="mt-1 text-muted-foreground">
                  {domainRow?.status ? domainRow.status : "não configurado"}
                  {domainRow?.last_error ? ` · ${domainRow.last_error}` : ""}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={saveDomain} disabled={pending}>
                  Salvar domínio
                </Button>
                <Button onClick={verifyDomain} disabled={pending || !domainRow?.domain}>
                  Verificar DNS
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Páginas</CardTitle>
              <CardDescription>Edite e publique as páginas institucionais.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {pages.map((p) => (
                <div key={p.key} className="rounded-xl border p-4 bg-muted/10 grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="font-medium">{p.key.toUpperCase()}</div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={p.is_published}
                        onChange={(e) =>
                          setPages((prev) => prev.map((x) => (x.key === p.key ? { ...x, is_published: e.target.checked } : x)))
                        }
                      />
                      Publicado
                    </label>
                  </div>
                  <div className="grid gap-2">
                    <Label>Título</Label>
                    <Input
                      value={p.title ?? ""}
                      onChange={(e) =>
                        setPages((prev) => prev.map((x) => (x.key === p.key ? { ...x, title: e.target.value } : x)))
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Conteúdo</Label>
                    <Textarea
                      value={p.content ?? ""}
                      onChange={(e) =>
                        setPages((prev) => prev.map((x) => (x.key === p.key ? { ...x, content: e.target.value } : x)))
                      }
                      className="min-h-28"
                    />
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-end gap-2">
                <Button onClick={savePages} disabled={pending}>
                  {pending ? busyMsg ?? "Processando..." : "Salvar páginas"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Banners</CardTitle>
              <CardDescription>Topbar, popup e outros destaques do site.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  Dica: comece com um banner <span className="font-medium">topbar</span> e um <span className="font-medium">popup</span>.
                </div>
                <Dialog open={newBannerOpen} onOpenChange={setNewBannerOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary">Novo banner</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Novo banner</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>Placement</Label>
                        <Select value={newBanner.placement} onValueChange={(v) => setNewBanner((b) => ({ ...b, placement: v as BannerPlacement }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="topbar">topbar</SelectItem>
                            <SelectItem value="popup">popup</SelectItem>
                            <SelectItem value="hero">hero</SelectItem>
                            <SelectItem value="footer">footer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Título</Label>
                        <Input value={newBanner.title ?? ""} onChange={(e) => setNewBanner((b) => ({ ...b, title: e.target.value }))} />
                      </div>
                      <div className="grid gap-2">
                        <Label>Texto</Label>
                        <Textarea value={newBanner.body ?? ""} onChange={(e) => setNewBanner((b) => ({ ...b, body: e.target.value }))} />
                      </div>

                      <div className="grid gap-2">
                        <Label>Imagem (opcional)</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          disabled={pending}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null
                            e.target.value = ""
                            if (f) void uploadBannerImage(f)
                          }}
                        />
                        {newBanner.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={newBanner.image_url} alt="Banner" className="mt-2 h-24 w-full object-cover rounded border" />
                        ) : null}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Link (opcional)</Label>
                          <Input value={newBanner.link_url ?? ""} onChange={(e) => setNewBanner((b) => ({ ...b, link_url: e.target.value }))} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Prioridade</Label>
                          <Input
                            inputMode="numeric"
                            value={String(newBanner.priority)}
                            onChange={(e) => setNewBanner((b) => ({ ...b, priority: Number(e.target.value) }))}
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Início (ISO opcional)</Label>
                          <Input
                            value={newBanner.starts_at ?? ""}
                            onChange={(e) => setNewBanner((b) => ({ ...b, starts_at: e.target.value }))}
                            placeholder="2026-02-13T00:00:00Z"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Fim (ISO opcional)</Label>
                          <Input
                            value={newBanner.ends_at ?? ""}
                            onChange={(e) => setNewBanner((b) => ({ ...b, ends_at: e.target.value }))}
                            placeholder="2026-02-20T00:00:00Z"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={newBanner.is_active} onChange={(e) => setNewBanner((b) => ({ ...b, is_active: e.target.checked }))} />
                        Ativo
                      </label>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewBannerOpen(false)} disabled={pending}>
                        Cancelar
                      </Button>
                      <Button onClick={createBanner} disabled={pending}>
                        {pending ? busyMsg ?? "Processando..." : "Criar banner"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Dialog
                open={editBannerOpen}
                onOpenChange={(open) => {
                  setEditBannerOpen(open)
                  if (!open) {
                    setEditBannerId(null)
                    setEditBanner(null)
                  }
                }}
              >
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Editar banner</DialogTitle>
                  </DialogHeader>

                  {editBanner ? (
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>Placement</Label>
                        <Select
                          value={editBanner.placement}
                          onValueChange={(v) =>
                            setEditBanner((b) => (b ? { ...b, placement: v as BannerPlacement } : b))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="topbar">topbar</SelectItem>
                            <SelectItem value="popup">popup</SelectItem>
                            <SelectItem value="hero">hero</SelectItem>
                            <SelectItem value="footer">footer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Título</Label>
                        <Input
                          value={editBanner.title ?? ""}
                          onChange={(e) => setEditBanner((b) => (b ? { ...b, title: e.target.value } : b))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Texto</Label>
                        <Textarea
                          value={editBanner.body ?? ""}
                          onChange={(e) => setEditBanner((b) => (b ? { ...b, body: e.target.value } : b))}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Imagem (opcional)</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          disabled={pending}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null
                            e.target.value = ""
                            if (f) void uploadEditBannerImage(f)
                          }}
                        />
                        {editBanner.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={editBanner.image_url}
                            alt="Banner"
                            className="mt-2 h-24 w-full object-cover rounded border"
                          />
                        ) : null}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Link (opcional)</Label>
                          <Input
                            value={editBanner.link_url ?? ""}
                            onChange={(e) => setEditBanner((b) => (b ? { ...b, link_url: e.target.value } : b))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Prioridade</Label>
                          <Input
                            inputMode="numeric"
                            value={String(editBanner.priority)}
                            onChange={(e) =>
                              setEditBanner((b) => (b ? { ...b, priority: Number(e.target.value) } : b))
                            }
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Início (ISO opcional)</Label>
                          <Input
                            value={editBanner.starts_at ?? ""}
                            onChange={(e) =>
                              setEditBanner((b) => (b ? { ...b, starts_at: e.target.value } : b))
                            }
                            placeholder="2026-02-13T00:00:00Z"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Fim (ISO opcional)</Label>
                          <Input
                            value={editBanner.ends_at ?? ""}
                            onChange={(e) => setEditBanner((b) => (b ? { ...b, ends_at: e.target.value } : b))}
                            placeholder="2026-02-20T00:00:00Z"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editBanner.is_active}
                          onChange={(e) =>
                            setEditBanner((b) => (b ? { ...b, is_active: e.target.checked } : b))
                          }
                        />
                        Ativo
                      </label>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">Carregando...</div>
                  )}

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditBannerOpen(false)} disabled={pending}>
                      Cancelar
                    </Button>
                    <Button onClick={saveEditBanner} disabled={pending || !editBannerId || !editBanner}>
                      {pending ? busyMsg ?? "Processando..." : "Salvar banner"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {banners.length === 0 ? (
                <div className="rounded-xl border bg-muted/10 p-4 text-sm text-muted-foreground">Nenhum banner cadastrado.</div>
              ) : (
                <div className="grid gap-3">
                  {banners.map((b) => (
                    <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/10 p-4">
                      <div className="min-w-[220px]">
                        <div className="text-sm font-medium">
                          {b.placement}{" "}
                          {!b.is_active ? <span className="text-xs text-muted-foreground">(inativo)</span> : null}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{b.title || "(sem título)"}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEditBanner(b)} disabled={pending}>
                          Editar
                        </Button>
                        <Link href={siteHref} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline">
                            Ver no site
                          </Button>
                        </Link>
                        <Button size="sm" variant="destructive" onClick={() => deleteBanner(b.id)} disabled={pending}>
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
  )
}
