"use client"

import { useState, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, MessageCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Props = {
  contactId: string
  phone: string | null
  status: string
}

function digitsOnly(input: string | null) {
  return (input || "").replace(/\D/g, "")
}

export function SiteContactQuickActions({ contactId, phone, status }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [isUpdating, setIsUpdating] = useState(false)

  const phoneDigits = digitsOnly(phone)
  const canWhatsapp = phoneDigits.length >= 10
  const canMarkContacted = status === "new"
  const canMarkQualified = status === "new" || status === "contacted"

  const updateStatus = async (
    event: MouseEvent<HTMLButtonElement>,
    nextStatus: "contacted" | "qualified",
    successMessage: string
  ) => {
    event.preventDefault()
    event.stopPropagation()

    setIsUpdating(true)
    try {
      const { error } = await supabase.from("contacts").update({ status: nextStatus }).eq("id", contactId)
      if (error) throw error
      toast.success(successMessage)
      router.refresh()
    } catch (error) {
      console.error(`Error updating contact status to ${nextStatus}:`, error)
      toast.error("Não foi possível atualizar o status do lead.")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleMarkContacted = async (event: MouseEvent<HTMLButtonElement>) => {
    if (!canMarkContacted) return
    await updateStatus(event, "contacted", "Lead marcado como contactado.")
  }

  const handleMarkQualified = async (event: MouseEvent<HTMLButtonElement>) => {
    if (!canMarkQualified) return
    await updateStatus(event, "qualified", "Lead marcado como qualificado.")
  }

  const handleOpenWhatsApp = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!canWhatsapp) return
    window.open(`https://wa.me/${phoneDigits}`, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
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
        {isUpdating ? "Salvando..." : canMarkContacted ? "Marcar atendido" : "Atendido"}
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
        {isUpdating ? "Salvando..." : canMarkQualified ? "Qualificar" : "Qualificado"}
      </Button>
    </div>
  )
}
