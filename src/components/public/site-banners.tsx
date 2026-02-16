"use client"

import { useEffect, useMemo, useState } from "react"
import type { SitePublicBanner } from "@/lib/site"

export function TopbarBanner({ banner }: { banner: SitePublicBanner }) {
  const href = banner.link_url || null

  const content = (
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
      <div className="flex items-center gap-3 text-sm">
        {banner.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.image_url}
            alt=""
            className="h-8 w-8 rounded-lg object-cover ring-1 ring-black/10"
          />
        ) : null}
        <span className="font-medium">{banner.title || "Aviso"}</span>
        {banner.body ? <span className="ml-2 text-muted-foreground">{banner.body}</span> : null}
      </div>
      {href ? (
        <a className="text-sm font-medium underline underline-offset-4" href={href} target="_blank" rel="noreferrer">
          Ver
        </a>
      ) : null}
    </div>
  )

  return (
    <div
      className="border-b bg-white/70 backdrop-blur"
      style={{ borderColor: "color-mix(in oklch, var(--site-primary) 20%, transparent)" }}
    >
      {content}
    </div>
  )
}

export function PopupBanner({ banner }: { banner: SitePublicBanner }) {
  const storageKey = useMemo(() => `site:popup:${banner.id}`, [banner.id])
  // Avoid hydration mismatch: never read `sessionStorage` during the initial render.
  // Server + first client render must match exactly.
  const [open, setOpen] = useState<boolean | null>(null)

  useEffect(() => {
    // Defer to avoid `react-hooks/set-state-in-effect` and keep hydration stable.
    const t = setTimeout(() => {
      try {
        const dismissed = sessionStorage.getItem(storageKey)
        setOpen(!dismissed)
      } catch {
        // If storage is unavailable (privacy mode, etc), default to showing the popup.
        setOpen(true)
      }
    }, 0)

    return () => clearTimeout(t)
  }, [storageKey])

  if (open !== true) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border bg-white shadow-xl">
        {banner.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner.image_url} alt={banner.title || ""} className="h-48 w-full object-cover" />
        ) : null}
        <div className="p-6">
          <div className="text-lg font-semibold">{banner.title || "Novidade"}</div>
          {banner.body ? <div className="mt-2 text-sm text-muted-foreground">{banner.body}</div> : null}
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              className="rounded-2xl border px-4 py-2 text-sm font-medium"
              onClick={() => {
                try {
                  sessionStorage.setItem(storageKey, "1")
                } catch {
                  // ignore
                }
                setOpen(false)
              }}
            >
              Fechar
            </button>
            {banner.link_url ? (
              <a
                className="rounded-2xl px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: "var(--site-primary)" }}
                href={banner.link_url}
                target="_blank"
                rel="noreferrer"
              >
                Saiba mais
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
