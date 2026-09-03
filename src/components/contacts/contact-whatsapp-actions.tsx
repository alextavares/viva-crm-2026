"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { recordExternalWhatsAppAttempt } from "@/app/actions/contacts"
import { sendOfficialWhatsAppMessage } from "@/app/actions/whatsapp"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildWhatsAppUrl } from "@/lib/whatsapp"

type Props = {
  contactId: string
  canSendOfficial: boolean
  phone: string | null
  defaultMessage: string
  traceSummary: string
}

export function ContactWhatsAppActions({
  contactId,
  canSendOfficial,
  phone,
  defaultMessage,
  traceSummary,
}: Props) {
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState(defaultMessage)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const openWaFallback = async () => {
    const waHref = phone
      ? buildWhatsAppUrl({
          phone,
          message,
        })
      : null
    if (!waHref) return
    const popup = window.open("", "_blank", "noopener,noreferrer")
    setSending(true)
    setErrorMsg(null)
    try {
      const result = await recordExternalWhatsAppAttempt({
        contactId,
        summary: traceSummary,
      })

      if (!result.success) {
        popup?.close()
        toast.error(result.error)
        setErrorMsg(result.error)
        return
      }

      if (popup) {
        popup.location.href = waHref
      } else {
        window.open(waHref, "_blank", "noopener,noreferrer")
      }
      toast.success("WhatsApp aberto e registrado na timeline.")
      router.refresh()
    } catch (error) {
      popup?.close()
      console.error("Error recording external WhatsApp:", error)
      setErrorMsg("Não foi possível registrar a tentativa de WhatsApp.")
      toast.error("Não foi possível registrar a tentativa de WhatsApp.")
    } finally {
      setSending(false)
    }
  }

  const sendOfficial = async () => {
    if (!canSendOfficial) {
      setErrorMsg("Sem permissão para envio oficial.")
      toast.error("Sem permissão para envio oficial.")
      return
    }
    setSending(true)
    setErrorMsg(null)
    try {
      const result = await sendOfficialWhatsAppMessage({
        contact_id: contactId,
        message,
      })

      if (result.success) {
        const mode = result.data?.mode
        if (mode === "fallback" && phone) {
          await openWaFallback()
          toast.warning(result.data.message)
          return
        }
        setMessage("")
        toast.success(
          mode === "sandbox"
            ? "Sandbox ativo: mensagem simulada e registrada no CRM."
            : "Mensagem enviada no WhatsApp Oficial."
        )
        return
      }

      setErrorMsg(result.error)
      toast.error(result.error)
    } catch (error) {
      console.error("Error sending WhatsApp official:", error)
      const genericError = "Falha ao enviar mensagem."
      setErrorMsg(genericError)
      toast.error(genericError)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      {canSendOfficial ? (
        <Input
          value={message}
          onChange={(e) => {
            setErrorMsg(null)
            setMessage(e.target.value.slice(0, 4096))
          }}
          placeholder="Escreva a mensagem para enviar no WhatsApp oficial"
          disabled={sending}
        />
      ) : null}

      {errorMsg ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMsg}
        </div>
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

      {phone ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => void openWaFallback()}
          disabled={sending}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          Abrir WhatsApp
        </Button>
      ) : null}
      </div>
    </div>
  )
}
