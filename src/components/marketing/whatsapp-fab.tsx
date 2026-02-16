"use client"

import Link from "next/link"

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
      className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-2 rounded-full bg-emerald-400 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-400/20 hover:bg-emerald-300"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-black/10 text-[12px] font-bold">WA</span>
      <span>WhatsApp</span>
    </Link>
  )
}

