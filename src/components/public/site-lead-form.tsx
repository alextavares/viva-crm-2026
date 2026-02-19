"use client"

import { useMemo, useState, useTransition } from "react"
import { createPublicClient } from "@/lib/supabase/public-client"
import { siteCreateLead } from "@/lib/site"

type Props = {
  siteSlug: string
  propertyId: string | null
  propertyTitle?: string | null
}

function digitsOnly(s: string) {
  return s.replace(/[^0-9]/g, "")
}

function trackLeadConversion(siteSlug: string, propertyId: string | null) {
  if (typeof window === "undefined") return
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    __vivaTracking?: {
      googleAdsConversionId?: string | null
      googleAdsConversionLabel?: string | null
    }
  }

  if (typeof w.gtag === "function") {
    w.gtag("event", "generate_lead", {
      source: "site_form",
      site_slug: siteSlug,
      property_id: propertyId ?? undefined,
    })

    const adsId = w.__vivaTracking?.googleAdsConversionId?.trim()
    const adsLabel = w.__vivaTracking?.googleAdsConversionLabel?.trim()
    if (adsId && adsLabel) {
      w.gtag("event", "conversion", {
        send_to: `${adsId}/${adsLabel}`,
      })
    }
  }

  if (typeof w.fbq === "function") {
    w.fbq("track", "Lead")
  }
}

export function SiteLeadForm({ siteSlug, propertyId, propertyTitle }: Props) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const normalizedPhonePreview = useMemo(() => digitsOnly(phone), [phone])

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        setStatus("idle")
        setErrorMsg(null)

        startTransition(async () => {
          const supabase = createPublicClient()
          const msg = message.trim()

          const { data, error } = await siteCreateLead(supabase, {
            siteSlug,
            propertyId,
            name: name.trim(),
            phone: phone.trim(),
            message: msg.length ? msg : null,
            sourceDomain: typeof window !== "undefined" ? window.location.host : null,
          })

          if (error || !data?.contact_id) {
            setStatus("error")
            setErrorMsg("Não foi possível enviar. Verifique os dados e tente novamente.")
            return
          }

          setStatus("ok")
          setName("")
          setPhone("")
          setMessage("")
          trackLeadConversion(siteSlug, propertyId)
        })
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            placeholder="Seu nome"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">WhatsApp</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm"
            placeholder="(11) 99999-9999"
          />
          {normalizedPhonePreview ? (
            <div className="mt-1 text-[11px] text-muted-foreground">
              Enviaremos com: {normalizedPhonePreview}
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Mensagem (opcional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="mt-1 min-h-24 w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm"
          placeholder={propertyTitle ? `Olá, vi o imóvel "${propertyTitle}" e gostaria de mais informações.` : "Olá, gostaria de mais informações."}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: "var(--site-primary)" }}
      >
        {pending ? "Enviando..." : "Enviar"}
      </button>

      {status === "ok" ? (
        <div className="rounded-2xl border bg-white p-3 text-sm text-green-700">
          Mensagem enviada com sucesso! (Destino: CRM da organização <strong>{siteSlug}</strong>)
        </div>
      ) : null}
      {status === "error" ? (
        <div className="rounded-2xl border bg-white p-3 text-sm text-red-600">
          {errorMsg}
        </div>
      ) : null}
    </form>
  )
}
