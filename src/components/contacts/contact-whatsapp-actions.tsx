"use client"

import { useState } from "react"
import { Loader2, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Props = {
  contactId: string
  canSendOfficial: boolean
  waHref: string | null
  defaultMessage: string
}

export function ContactWhatsAppActions({
  contactId,
  canSendOfficial,
  waHref,
  defaultMessage,
}: Props) {
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState(defaultMessage)

  const openWaFallback = () => {
    if (!waHref) return
    window.open(waHref, "_blank", "noopener,noreferrer")
  }

  const sendOfficial = async () => {
    if (!canSendOfficial) {
      toast.error("Sem permissão para envio oficial.")
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          message,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        const mode = (data as { mode?: string }).mode
        toast.success(
          mode === "sandbox"
            ? "Sandbox ativo: mensagem simulada e registrada no CRM."
            : "Mensagem enviada no WhatsApp Oficial."
        )
        return
      }

      const fallbackEligible = res.status === 409 || res.status === 502 || res.status === 500
      if (fallbackEligible && waHref) {
        openWaFallback()
        toast.warning("Canal oficial indisponível. Abrimos o WhatsApp web.")
      } else {
        toast.error((data as { message?: string })?.message || "Falha ao enviar mensagem.")
      }
    } catch (error) {
      console.error("Error sending WhatsApp official:", error)
      if (waHref) {
        openWaFallback()
        toast.warning("Falha no envio oficial. Abrimos o WhatsApp web.")
      } else {
        toast.error("Falha ao enviar mensagem.")
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      {canSendOfficial ? (
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 4096))}
          placeholder="Escreva a mensagem para enviar no WhatsApp oficial"
          disabled={sending}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
      {canSendOfficial ? (
        <Button
          type="button"
          onClick={sendOfficial}
          disabled={sending || !message.trim()}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
          {sending ? "Enviando..." : "Enviar WhatsApp Oficial"}
        </Button>
      ) : null}

      {waHref ? (
        <a
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
          href={waHref}
          target="_blank"
          rel="noreferrer"
        >
          Abrir WhatsApp
        </a>
      ) : null}
      </div>
    </div>
  )
}
