"use client"

import { useState, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, MessageCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { recordExternalWhatsAppAttempt, updateContactStatus } from "@/app/actions/contacts"
import { buildWhatsAppUrl } from "@/lib/whatsapp"
import {
  buildBrokerWhatsAppMessage,
  buildExternalWhatsAppTraceSummary,
} from "@/lib/whatsapp-context"

type Props = {
  contactId: string
  phone: string | null
  status: string
  contactName?: string | null
  propertyTitle?: string | null
  propertyCode?: string | null
  propertyAddress?: string | null
  onOptimisticUpdate?: (nextStatus: string) => void
  onRevertUpdate?: () => void
}

function digitsOnly(input: string | null) {
  return (input || "").replace(/\D/g, "")
}

export function SiteContactQuickActions({
  contactId,
  phone,
  status,
  contactName,
  propertyTitle,
  propertyCode,
  propertyAddress,
  onOptimisticUpdate,
  onRevertUpdate,
}: Props) {
  const router = useRouter()
  const [isUpdating, setIsUpdating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const phoneDigits = digitsOnly(phone)
  const canWhatsapp = phoneDigits.length >= 10
  const canMarkContacted = status === "new"
  const canMarkQualified = status === "new" || status === "contacted"
  const whatsappMessage = buildBrokerWhatsAppMessage({
    contactName,
    propertyTitle,
    propertyCode,
    propertyAddress,
  })
  const whatsappHref = phone
    ? buildWhatsAppUrl({
        phone,
        message: whatsappMessage,
      })
    : null
  const traceSummary = buildExternalWhatsAppTraceSummary({
    propertyTitle,
    propertyCode,
    propertyAddress,
  })

  const updateStatus = async (
    event: MouseEvent<HTMLButtonElement>,
    nextStatus: "contacted" | "qualified",
    successMessage: string
  ) => {
    event.preventDefault()
    event.stopPropagation()

    setIsUpdating(true)
    setErrorMsg(null)
    onOptimisticUpdate?.(nextStatus)
    try {
      const result = await updateContactStatus(contactId, nextStatus)
      if (!result.success) {
        setErrorMsg(result.error)
        toast.error(result.error)
        onRevertUpdate?.()
        return
      }
      toast.success(successMessage)
      router.refresh()
    } catch (error) {
      console.error(`Error updating contact status to ${nextStatus}:`, error)
      const message = error instanceof Error ? error.message : "Não foi possível atualizar o status do lead."
      setErrorMsg(message)
      toast.error(message)
      onRevertUpdate?.()
    } finally {
      setIsUpdating(false)
    }
  }

  const handleMarkContacted = async (event: MouseEvent<HTMLButtonElement>) => {
    if (!canMarkContacted) return
    await updateStatus(event, "contacted", "Lead marcado como em atendimento.")
  }

  const handleMarkQualified = async (event: MouseEvent<HTMLButtonElement>) => {
    if (!canMarkQualified) return
    await updateStatus(event, "qualified", "Lead marcado como qualificado.")
  }

  const handleOpenWhatsApp = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!canWhatsapp || !whatsappHref) return
    const popup = window.open("", "_blank", "noopener,noreferrer")

    const result = await recordExternalWhatsAppAttempt({ contactId, summary: traceSummary })
    if (!result.success) {
      popup?.close()
      toast.error(result.error)
      return
    }

    if (popup) {
      popup.location.href = whatsappHref
    } else {
      window.open(whatsappHref, "_blank", "noopener,noreferrer")
    }
    toast.success("WhatsApp aberto e registrado na timeline.")
    router.refresh()
  }

  return (
    <div className="mt-3 space-y-2" onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap gap-2">
      {canWhatsapp && (
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={handleOpenWhatsApp}>
          <MessageCircle className="mr-1 h-3.5 w-3.5" />
          WhatsApp
        </Button>
      )}

      <Button
        type="button"
        size="sm"
        variant={canMarkContacted ? "default" : "secondary"}
        className="h-8 text-xs"
        disabled={!canMarkContacted || isUpdating}
        onClick={handleMarkContacted}
      >
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
        {isUpdating ? "Salvando..." : canMarkContacted ? "Iniciar atendimento" : "Em atendimento"}
      </Button>

      <Button
        type="button"
        size="sm"
        variant={canMarkQualified ? "outline" : "secondary"}
        className="h-8 text-xs"
        disabled={!canMarkQualified || isUpdating}
        onClick={handleMarkQualified}
      >
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
        {isUpdating ? "Salvando..." : canMarkQualified ? "Qualificar lead" : "Qualificado"}
      </Button>
      </div>
      {errorMsg ? <p className="text-xs text-red-600 font-medium mt-1">{errorMsg}</p> : null}
    </div>
  )
}
