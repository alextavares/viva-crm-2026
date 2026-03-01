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
import {
  createMediaUploadPath,
  extractStoragePathForBucket,
  resolveMediaPathUrl,
  resolveMediaUrl,
  uploadPublicMedia,
} from "@/lib/media"

type OrgInfo = { id: string; name: string; slug: string }

type SiteSettingsRow = {
  organization_id: string
  theme: "search_first" | "premium"
  brand_name: string | null
  logo_url: string | null
  logo_path: string | null
  primary_color: string | null
  secondary_color: string | null
  whatsapp: string | null
  phone: string | null
  email: string | null
  ga4_measurement_id: string | null
  meta_pixel_id: string | null
  google_site_verification: string | null
  facebook_domain_verification: string | null
  google_ads_conversion_id: string | null
  google_ads_conversion_label: string | null
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
type BannerVariant = "compact" | "destaque"

type SiteBannerRow = {
  id: string
  placement: BannerPlacement
  variant: BannerVariant
  title: string | null
  body: string | null
  image_url: string | null
  image_path: string | null
  link_url: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  priority: number
}

function getPlacementHint(placement: BannerPlacement) {
  switch (placement) {
    case "hero":
      return "Hero: use imagem horizontal (recomendado 1600x700)."
    case "topbar":
      return "Topbar: use ícone ou imagem quadrada (recomendado 256x256)."
    case "popup":
      return "Popup: use imagem horizontal (recomendado 1200x800)."
    case "footer":
      return "Footer: use imagem horizontal curta (recomendado 1200x300)."
    default:
      return ""
  }
}

function HeroVariantPreview({
  title,
  body,
  imageSrc,
  variant,
}: {
  title: string | null
  body: string | null
  imageSrc: string | null
  variant: BannerVariant
}) {
  const isHighlight = variant === "destaque"
  return (
    <div className="rounded-xl border bg-muted/10 p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        Prévia do hero ({isHighlight ? "destaque" : "compacto"})
      </div>
      <div className={`grid overflow-hidden rounded-lg border bg-white ${isHighlight ? "md:grid-cols-2" : "md:grid-cols-[0.95fr_1.05fr]"}`}>
        <div className={`${isHighlight ? "p-4 md:p-5" : "p-3 md:p-4"}`}>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Destaque</div>
          <div className={`${isHighlight ? "mt-2 text-lg md:text-xl" : "mt-2 text-base md:text-lg"} font-semibold leading-tight`}>
            {title?.trim() || "Título do banner hero"}
          </div>
          <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            {body?.trim() || "Texto do banner hero para destacar uma oferta, lançamento ou campanha."}
          </div>
        </div>
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt="Prévia hero"
            className={`w-full object-cover ${isHighlight ? "h-32 md:h-40" : "h-24 md:h-28"}`}
          />
        ) : (
          <div
            className={isHighlight ? "h-32 md:h-40" : "h-24 md:h-28"}
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklch, var(--site-primary) 20%, transparent), color-mix(in oklch, var(--site-secondary) 20%, transparent))",
            }}
          />
        )}
      </div>
    </div>
  )
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
    hasSiteLead?: boolean
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
    variant: v.variant === "destaque" ? "destaque" : "compact",
    title: typeof v.title === "string" ? v.title : v.title == null ? null : String(v.title),
    body: typeof v.body === "string" ? v.body : v.body == null ? null : String(v.body),
    image_url: typeof v.image_url === "string" ? v.image_url : v.image_url == null ? null : String(v.image_url),
    image_path: typeof v.image_path === "string" ? v.image_path : v.image_path == null ? null : String(v.image_path),
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

function validateTrackingValues(settings: SiteSettingsRow): string | null {
  const ga4 = settings.ga4_measurement_id?.trim()
  if (ga4 && !/^G-[A-Z0-9]+$/i.test(ga4)) {
    return "GA4 inválido. Use o formato G-XXXXXXXX."
  }

  const pixel = settings.meta_pixel_id?.trim()
  if (pixel && !/^[0-9]{6,20}$/.test(pixel)) {
    return "Meta Pixel inválido. Use somente números."
  }

  const adsId = settings.google_ads_conversion_id?.trim()
  if (adsId && !/^AW-[0-9]+$/i.test(adsId)) {
    return "Google Ads Conversion ID inválido. Use o formato AW-123456789."
  }

  const adsLabel = settings.google_ads_conversion_label?.trim()
  if (adsLabel && !/^[A-Za-z0-9_-]{2,120}$/.test(adsLabel)) {
    return "Google Ads Conversion Label inválido."
  }

  return null
}

async function uploadSiteAsset(
  supabase: SupabaseClient,
  opts: { orgId: string; file: File; kind: "logo" | "banner" }
): Promise<{ publicUrl: string; path: string }> {
  const ext = opts.file.name.split(".").pop() || "png"
  const path = createMediaUploadPath({
    organizationId: opts.orgId,
    scope: "site",
    kind: opts.kind,
    extension: ext,
  })
  const { publicUrl } = await uploadPublicMedia({
    supabase,
    bucket: "site-assets",
    path,
    file: opts.file,
    upsert: true,
    cacheControl: "3600",
  })
  return { publicUrl, path }
}

function validateSiteAssetFile(file: File, kind: "logo" | "banner") {
  if (!file.type.startsWith("image/")) {
    return "Envie um arquivo de imagem valido."
  }

  const maxBytes = kind === "logo" ? 2 * 1024 * 1024 : 5 * 1024 * 1024
  if (file.size > maxBytes) {
    return kind === "logo"
      ? "A logo deve ter no maximo 2 MB. Tente uma imagem menor."
      : "A imagem deve ter no maximo 5 MB. Tente uma imagem menor."
  }

  return null
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
    opts?: { busy?: string; timeoutMs?: number; timeoutMessage?: string }
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
        toast.error(opts?.timeoutMessage ?? "Demorou demais para salvar. Tente novamente.")
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
      logo_path: s?.logo_path ?? null,
      primary_color: s?.primary_color ?? "#0b1220",
      secondary_color: s?.secondary_color ?? "#22c55e",
      whatsapp: s?.whatsapp ?? "",
      phone: s?.phone ?? "",
      email: s?.email ?? "",
      ga4_measurement_id: s?.ga4_measurement_id ?? "",
      meta_pixel_id: s?.meta_pixel_id ?? "",
      google_site_verification: s?.google_site_verification ?? "",
      facebook_domain_verification: s?.facebook_domain_verification ?? "",
      google_ads_conversion_id: s?.google_ads_conversion_id ?? "",
      google_ads_conversion_label: s?.google_ads_conversion_label ?? "",
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
    variant: "compact",
    title: "",
    body: "",
    image_url: "",
    image_path: "",
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
  const hasPreviewReady = Boolean(org.slug?.trim())
  const hasDomainReady = isDomainVerified || hasPreviewReady
  const hasPublicProperty = Boolean(checklist?.hasPublicProperty)
  const hasSiteLead = Boolean(checklist?.hasSiteLead)
  const hasGa4 = Boolean(settings.ga4_measurement_id?.trim())
  const hasMetaPixel = Boolean(settings.meta_pixel_id?.trim())
  const hasGoogleAds = Boolean(settings.google_ads_conversion_id?.trim() && settings.google_ads_conversion_label?.trim())
  const hasVerificationTokens = Boolean(
    settings.google_site_verification?.trim() || settings.facebook_domain_verification?.trim()
  )
  const trackingConfigured = [hasGa4, hasMetaPixel, hasGoogleAds, hasVerificationTokens].filter(Boolean).length
  const trackingSteps = [
    {
      key: "ga4",
      title: "Etapa 1 · GA4",
      done: hasGa4,
      value: settings.ga4_measurement_id?.trim() ? `ID: ${settings.ga4_measurement_id?.trim()}` : "Não configurado",
      action: hasGa4
        ? "Teste agora no DevTools: Network > collect?v=2 após enviar um lead."
        : "Preencha o Measurement ID (G-...) e clique em Salvar rastreamento.",
      href: "#tracking-ga4",
    },
    {
      key: "pixel",
      title: "Etapa 2 · Meta Pixel",
      done: hasMetaPixel,
      value: settings.meta_pixel_id?.trim() ? `Pixel: ${settings.meta_pixel_id?.trim()}` : "Não configurado",
      action: hasMetaPixel
        ? "Teste agora no DevTools: Network > tr?id=... após enviar um lead."
        : "Preencha o Pixel ID (somente números) e salve.",
      href: "#tracking-meta-pixel",
    },
    {
      key: "ads",
      title: "Etapa 3 · Google Ads",
      done: hasGoogleAds,
      value:
        hasGoogleAds && settings.google_ads_conversion_id && settings.google_ads_conversion_label
          ? `${settings.google_ads_conversion_id} / ${settings.google_ads_conversion_label}`
          : "Não configurado",
      action: hasGoogleAds
        ? "Envie um lead teste e valide evento conversion com send_to correto."
        : "Preencha Conversion ID (AW-...) + Conversion Label e salve.",
      href: "#tracking-google-ads-id",
    },
    {
      key: "verification",
      title: "Etapa 4 · Verificação de domínio",
      done: hasVerificationTokens,
      value: hasVerificationTokens ? "Token configurado" : "Não configurado",
      action: hasVerificationTokens
        ? "Valide no Search Console e no Meta Business com seu domínio público."
        : "Cole token do Google e/ou Meta, salve e valide no provedor.",
      href: "#tracking-google-site-verification",
    },
  ]
  const activationSteps = [
    {
      done: hasRequiredContact,
      title: "Marca + WhatsApp + E-mail configurados",
      hint: "Necessário para captar e responder leads.",
    },
    {
      done: hasDomainReady,
      title: "Site pronto para abrir (domínio ou preview)",
      hint: isDomainVerified ? "Domínio verificado com sucesso." : "Use o preview enquanto o domínio não é verificado.",
    },
    {
      done: trackingConfigured > 0,
      title: "Rastreamento configurado",
      hint: "Configure GA4, Meta Pixel ou Google Ads para medir conversão.",
    },
    {
      done: hasPublicProperty,
      title: "Existe pelo menos 1 imóvel visível no site",
      hint: "Use Publicar em massa ou o toggle na lista de imóveis.",
    },
    {
      done: hasSiteLead,
      title: "Primeiro lead recebido no CRM",
      hint: "Envie um lead teste pelo formulário público e valide em Contatos.",
    },
  ]

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
        organization_id: org.id,
        theme: settings.theme,
        brand_name: settings.brand_name?.trim() || null,
        logo_url: settings.logo_url?.trim() || null,
        logo_path: settings.logo_path?.trim() || extractStoragePathForBucket(settings.logo_url, "site-assets"),
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

  const saveTrackingSettings = () => {
    const trackingError = validateTrackingValues(settings)
    if (trackingError) {
      toast.error(trackingError)
      return
    }

    void run(async (signal) => {
      const payload = {
        organization_id: org.id,
        ga4_measurement_id: settings.ga4_measurement_id?.trim() || null,
        meta_pixel_id: settings.meta_pixel_id?.trim() || null,
        google_site_verification: settings.google_site_verification?.trim() || null,
        facebook_domain_verification: settings.facebook_domain_verification?.trim() || null,
        google_ads_conversion_id: settings.google_ads_conversion_id?.trim() || null,
        google_ads_conversion_label: settings.google_ads_conversion_label?.trim() || null,
        updated_at: nowIso(),
      }

      const { error } = await supabase.from("site_settings").upsert(payload).abortSignal(signal)
      if (error) throw error

      toast.success("Rastreamento salvo.")
    }, "Error saving tracking settings:", { busy: "Salvando rastreamento..." })
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
    const validationError = validateSiteAssetFile(file, "logo")
    if (validationError) {
      toast.error(validationError)
      return
    }

    await runPlain(async () => {
      const { publicUrl, path } = await uploadSiteAsset(supabase, { orgId: org.id, file, kind: "logo" })
      setSettings((s) => ({ ...s, logo_url: publicUrl, logo_path: path }))
      toast.success("Logo enviado. Clique em Salvar para aplicar.")
    }, "Logo upload failed:", {
      busy: "Enviando logo...",
      timeoutMs: 20000,
      timeoutMessage: "Upload da logo demorou demais. Tente uma imagem menor ou tente novamente.",
    })
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
      const normalizedVariant: BannerVariant =
        newBanner.placement === "hero" && newBanner.variant === "destaque" ? "destaque" : "compact"
      const payload = {
        organization_id: org.id,
        placement: newBanner.placement,
        variant: normalizedVariant,
        title: newBanner.title?.trim() || null,
        body: newBanner.body?.trim() || null,
        image_url: newBanner.image_url?.trim() || null,
        image_path: newBanner.image_path?.trim() || extractStoragePathForBucket(newBanner.image_url, "site-assets"),
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
        variant: "compact",
        title: "",
        body: "",
        image_url: "",
        image_path: "",
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
      variant: b.variant,
      title: b.title ?? "",
      body: b.body ?? "",
      image_url: b.image_url ?? "",
      image_path: b.image_path ?? "",
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
      const normalizedVariant: BannerVariant =
        editBanner.placement === "hero" && editBanner.variant === "destaque" ? "destaque" : "compact"
      const payload = {
        placement: editBanner.placement,
        variant: normalizedVariant,
        title: editBanner.title?.trim() || null,
        body: editBanner.body?.trim() || null,
        image_url: editBanner.image_url?.trim() || null,
        image_path: editBanner.image_path?.trim() || extractStoragePathForBucket(editBanner.image_url, "site-assets"),
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
    const validationError = validateSiteAssetFile(file, "banner")
    if (validationError) {
      toast.error(validationError)
      return
    }

    await runPlain(async () => {
      const { publicUrl, path } = await uploadSiteAsset(supabase, { orgId: org.id, file, kind: "banner" })
      setEditBanner((b) => (b ? { ...b, image_url: publicUrl, image_path: path } : b))
      toast.success("Imagem enviada. Salve o banner para aplicar.")
    }, "Edit banner upload failed:", {
      busy: "Enviando imagem...",
      timeoutMs: 30000,
      timeoutMessage: "Upload da imagem demorou demais. Tente uma imagem menor ou tente novamente.",
    })
  }

  const uploadBannerImage = async (file: File) => {
    const validationError = validateSiteAssetFile(file, "banner")
    if (validationError) {
      toast.error(validationError)
      return
    }

    await runPlain(async () => {
      const { publicUrl, path } = await uploadSiteAsset(supabase, { orgId: org.id, file, kind: "banner" })
      setNewBanner((b) => ({ ...b, image_url: publicUrl, image_path: path }))
      toast.success("Imagem enviada. Salve o banner para aplicar.")
    }, "Banner upload failed:", {
      busy: "Enviando imagem...",
      timeoutMs: 30000,
      timeoutMessage: "Upload da imagem demorou demais. Tente uma imagem menor ou tente novamente.",
    })
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

          <Card id="site-section-nav">
            <CardHeader>
              <CardTitle>Navegação rápida</CardTitle>
              <CardDescription>Atalho para as seções mais usadas.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="#site-section-brand">Marca e contato</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="#site-section-domain">Domínio próprio</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="#site-section-tracking">Rastreamento</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="#site-section-pages">Páginas</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="#site-section-banners">Banners</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="#site-section-news">Notícias</a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="#site-section-links">Links úteis</a>
              </Button>
            </CardContent>
          </Card>

          <Card id="site-section-checklist">
            <CardHeader>
              <CardTitle>Onboarding de ativação</CardTitle>
              <CardDescription>Antes de divulgar o site, confirme os itens críticos de go-live.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="text-sm text-muted-foreground">
                {activationSteps.filter((x) => x.done).length}/{activationSteps.length} concluídos
              </div>
              {activationSteps.map((item) => (
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
                <Link href={`/s/${org.slug}/contact`} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">Testar formulário público</Button>
                </Link>
                <Link href="/contacts">
                  <Button variant="outline" size="sm">Ver contatos</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card id="site-section-brand">
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
                  <Label>Template do site</Label>
                  <Select
                    value={settings.theme}
                    onValueChange={(v) => setSettings((s) => ({ ...s, theme: v as SiteSettingsRow["theme"] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="search_first">Conversao</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Escolha a apresentacao do site publico. O template Conversao prioriza busca e lead rapido; o
                    Premium destaca imagem, curadoria e percepcao de valor.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div
                  className={`rounded-2xl border p-4 ${
                    settings.theme === "search_first" ? "border-foreground bg-muted/20" : "bg-background"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Conversao
                  </div>
                  <div className="mt-2 text-sm font-semibold">Busca forte e CTA direto</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Hero orientado a captacao, leitura rapida dos cards e foco em gerar contato com menos friccao.
                  </div>
                </div>
                <div
                  className={`rounded-2xl border p-4 ${
                    settings.theme === "premium" ? "border-foreground bg-muted/20" : "bg-background"
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Premium
                  </div>
                  <div className="mt-2 text-sm font-semibold">Vitrine mais elegante e consultiva</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Hero editorial, cards mais amplos e ficha do imovel com apresentacao mais sofisticada.
                  </div>
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
                  {(settings.logo_url || settings.logo_path) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={
                        resolveMediaPathUrl("site-assets", settings.logo_path) ??
                        resolveMediaUrl(settings.logo_url) ??
                        settings.logo_url ??
                        ""
                      }
                      alt="Logo"
                      className="mt-2 h-10 w-auto rounded bg-white p-1 border"
                    />
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

          <Card id="site-section-domain">
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

          <Card id="site-section-tracking">
            <CardHeader>
              <CardTitle>Rastreamento</CardTitle>
              <CardDescription>
                Opcional. Configure analytics e pixel para medir visitas e conversões de lead do site.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2 rounded-lg border bg-muted/10 p-3 text-sm">
                <div className="font-medium">Status de configuração</div>
                <div className="text-muted-foreground">
                  {trackingConfigured}/4 blocos configurados (GA4, Meta Pixel, Google Ads, Verificações).
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
                <div className="text-sm font-medium">Checklist guiado</div>
                {trackingSteps.map((step) => (
                  <div key={step.key} className="rounded-lg border bg-background p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {step.done ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="text-sm font-medium">{step.title}</div>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <a href={step.href}>Ir para campo</a>
                      </Button>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{step.value}</div>
                    <div className="mt-1 text-xs">{step.action}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>GA4 Measurement ID</Label>
                  <Input
                    id="tracking-ga4"
                    value={settings.ga4_measurement_id ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, ga4_measurement_id: e.target.value }))}
                    placeholder="G-XXXXXXXXXX"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Meta Pixel ID</Label>
                  <Input
                    id="tracking-meta-pixel"
                    value={settings.meta_pixel_id ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, meta_pixel_id: e.target.value }))}
                    placeholder="123456789012345"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Google Site Verification</Label>
                  <Input
                    id="tracking-google-site-verification"
                    value={settings.google_site_verification ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, google_site_verification: e.target.value }))}
                    placeholder="token de verificação do Search Console"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Facebook Domain Verification</Label>
                  <Input
                    id="tracking-facebook-domain-verification"
                    value={settings.facebook_domain_verification ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, facebook_domain_verification: e.target.value }))}
                    placeholder="token de verificação de domínio"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Google Ads Conversion ID</Label>
                  <Input
                    id="tracking-google-ads-id"
                    value={settings.google_ads_conversion_id ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, google_ads_conversion_id: e.target.value }))}
                    placeholder="AW-123456789"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Google Ads Conversion Label</Label>
                  <Input
                    id="tracking-google-ads-label"
                    value={settings.google_ads_conversion_label ?? ""}
                    onChange={(e) => setSettings((s) => ({ ...s, google_ads_conversion_label: e.target.value }))}
                    placeholder="AbCdEfGhIjKlMnOpQr"
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground">
                Eventos enviados automaticamente no lead: <span className="font-medium">GA4 generate_lead</span>,{" "}
                <span className="font-medium">Meta Lead</span> e conversão do Google Ads (quando ID + label estiverem preenchidos).
              </div>

              <div className="rounded-lg border bg-muted/10 p-3 text-xs text-muted-foreground">
                Dica de validação: abra o DevTools &gt; Network e filtre por <span className="font-medium">collect?v=2</span> (GA4) e{" "}
                <span className="font-medium">tr?id=</span> (Meta Pixel) após enviar um lead.
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button onClick={saveTrackingSettings} disabled={pending}>
                  {pending ? busyMsg ?? "Processando..." : "Salvar rastreamento"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card id="site-section-pages">
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

          <Card id="site-section-banners">
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
                        <Select
                          value={newBanner.placement}
                          onValueChange={(v) =>
                            setNewBanner((b) => ({
                              ...b,
                              placement: v as BannerPlacement,
                              variant: v === "hero" ? b.variant : "compact",
                            }))
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
                        <p className="text-xs text-muted-foreground">{getPlacementHint(newBanner.placement)}</p>
                      </div>
                      {newBanner.placement === "hero" ? (
                        <div className="grid gap-2">
                          <Label>Estilo do hero</Label>
                          <Select
                            value={newBanner.variant}
                            onValueChange={(v) => setNewBanner((b) => ({ ...b, variant: v as BannerVariant }))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="compact">Compacto</SelectItem>
                              <SelectItem value="destaque">Destaque</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

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
                        {(newBanner.image_url || newBanner.image_path) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              resolveMediaPathUrl("site-assets", newBanner.image_path) ??
                              resolveMediaUrl(newBanner.image_url) ??
                              newBanner.image_url ??
                              ""
                            }
                            alt="Banner"
                            className="mt-2 h-24 w-full object-cover rounded border"
                          />
                        ) : null}
                      </div>
                      {newBanner.placement === "hero" ? (
                        <HeroVariantPreview
                          title={newBanner.title}
                          body={newBanner.body}
                          imageSrc={
                            resolveMediaPathUrl("site-assets", newBanner.image_path) ??
                            resolveMediaUrl(newBanner.image_url) ??
                            newBanner.image_url ??
                            null
                          }
                          variant={newBanner.variant}
                        />
                      ) : null}

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
                            setEditBanner((b) =>
                              b
                                ? {
                                    ...b,
                                    placement: v as BannerPlacement,
                                    variant: v === "hero" ? b.variant : "compact",
                                  }
                                : b
                            )
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
                        <p className="text-xs text-muted-foreground">{getPlacementHint(editBanner.placement)}</p>
                      </div>
                      {editBanner.placement === "hero" ? (
                        <div className="grid gap-2">
                          <Label>Estilo do hero</Label>
                          <Select
                            value={editBanner.variant}
                            onValueChange={(v) =>
                              setEditBanner((b) => (b ? { ...b, variant: v as BannerVariant } : b))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="compact">Compacto</SelectItem>
                              <SelectItem value="destaque">Destaque</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}

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
                        {(editBanner.image_url || editBanner.image_path) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={
                              resolveMediaPathUrl("site-assets", editBanner.image_path) ??
                              resolveMediaUrl(editBanner.image_url) ??
                              editBanner.image_url ??
                              ""
                            }
                            alt="Banner"
                            className="mt-2 h-24 w-full object-cover rounded border"
                          />
                        ) : null}
                      </div>
                      {editBanner.placement === "hero" ? (
                        <HeroVariantPreview
                          title={editBanner.title}
                          body={editBanner.body}
                          imageSrc={
                            resolveMediaPathUrl("site-assets", editBanner.image_path) ??
                            resolveMediaUrl(editBanner.image_url) ??
                            editBanner.image_url ??
                            null
                          }
                          variant={editBanner.variant}
                        />
                      ) : null}

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
                          {b.placement === "hero" ? (
                            <span className="ml-2 text-xs text-muted-foreground">[{b.variant === "destaque" ? "destaque" : "compacto"}]</span>
                          ) : null}
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
