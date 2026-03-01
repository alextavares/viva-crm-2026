"use client"

import { useEffect, useMemo, useState } from "react"
import type { SitePublicBanner } from "@/lib/site"
import { resolveMediaPathUrl, resolveMediaUrl } from "@/lib/media"

export function PopupBanner({ banner }: { banner: SitePublicBanner }) {
  const imageSrc =
    resolveMediaPathUrl("site-assets", banner.image_path) ??
    resolveMediaUrl(banner.image_url) ??
    banner.image_url
  const storageKey = useMemo(() => `site:popup:${banner.id}`, [banner.id])
  const [open, setOpen] = useState<boolean | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const dismissed = sessionStorage.getItem(storageKey)
        setOpen(!dismissed)
      } catch {
        setOpen(true)
      }
    }, 0)

    return () => clearTimeout(t)
  }, [storageKey])

  if (open !== true) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border bg-white shadow-xl">
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt={banner.title || ""} className="h-48 w-full object-cover" />
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
