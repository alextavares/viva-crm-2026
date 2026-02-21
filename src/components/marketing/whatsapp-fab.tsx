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
      className="wa-wave-btn fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-400/20 hover:bg-emerald-300"
      style={{ ["--wa-wave-color" as string]: "rgb(52 211 153)" }}
    >
      <WhatsAppWave />
      <span className="relative z-10 grid h-7 w-7 place-items-center rounded-full bg-black/10">
        <WhatsAppIcon />
      </span>
      <span className="relative z-10">WhatsApp</span>
    </Link>
  )
}
