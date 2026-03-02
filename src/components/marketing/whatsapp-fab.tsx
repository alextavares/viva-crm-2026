"use client"

import Link from "next/link"
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon"
import { WhatsAppWave } from "@/components/ui/whatsapp-wave"

export function WhatsAppFab({
  phoneE164,
  text,
}: {
  phoneE164: string
  text: string
}) {
  const wa = `https://wa.me/${encodeURIComponent(phoneE164)}?text=${encodeURIComponent(text)}`

  return (
    <Link
      href={wa}
      target="_blank"
      rel="noopener noreferrer"
      className="wa-wave-btn fixed z-50 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 md:px-4"
      style={{
        ["--wa-wave-color" as string]: "rgba(255,255,255,0.98)",
        ["--wa-wave-size" as string]: "28px",
        ["--wa-wave-border-width" as string]: "2.5px",
        position: "fixed",
        right: "1.25rem",
        bottom: "1.25rem",
        left: "auto",
      }}
    >
      <span className="relative z-10 grid h-8 w-8 place-items-center rounded-full bg-white text-emerald-600 shadow-sm md:h-7 md:w-7">
        <WhatsAppWave />
        <WhatsAppIcon className="h-4 w-4 md:h-3.5 md:w-3.5" />
      </span>
      <span className="relative z-10 hidden md:inline">WhatsApp</span>
    </Link>
  )
}
