"use client"

import { useState, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ExternalLink, Building } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Props = {
    contactId: string
    type: string
    status: string
    onOptimisticUpdate?: (nextStatus: string) => void
    onRevertUpdate?: () => void
}

export function ContactListPrimaryAction({ contactId, type, status, onOptimisticUpdate, onRevertUpdate }: Props) {
    const router = useRouter()
    const supabase = createClient()
    const [isUpdating, setIsUpdating] = useState(false)

    const updateStatus = async (
        event: MouseEvent<HTMLButtonElement>,
        nextStatus: "contacted" | "qualified",
        successMessage: string
    ) => {
        event.preventDefault()
        event.stopPropagation()

        setIsUpdating(true)
        if (onOptimisticUpdate) onOptimisticUpdate(nextStatus)

        try {
            const { error } = await supabase.from("contacts").update({ status: nextStatus }).eq("id", contactId)
            if (error) throw error
            toast.success(successMessage)
            router.refresh()
        } catch (error) {
            console.error(`Error updating contact status to ${nextStatus}:`, error)
            toast.error("Não foi possível atualizar o status do lead.")
            if (onRevertUpdate) onRevertUpdate()
        } finally {
            setIsUpdating(false)
        }
    }

    if (type === "lead") {
        if (status === "new") {
            return (
                <div onClick={(e) => e.stopPropagation()}>
                    <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={isUpdating}
                        onClick={(e) => updateStatus(e, "contacted", "Lead marcado como em atendimento.")}
                    >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {isUpdating ? "Atualizando..." : "Atender"}
                    </Button>
                </div>
            )
        }
        if (status === "contacted") {
            return (
                <div onClick={(e) => e.stopPropagation()}>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                        disabled={isUpdating}
                        onClick={(e) => updateStatus(e, "qualified", "Lead marcado como qualificado.")}
                    >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {isUpdating ? "Atualizando..." : "Qualificar"}
                    </Button>
                </div>
            )
        }
    }

    if (type === "owner") {
        return (
            <div 
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    router.push(`/contacts/${contactId}?tab=properties`)
                }}
                className="flex bg-secondary/50 hover:bg-secondary text-secondary-foreground text-xs font-medium px-3 py-1.5 rounded-md transition-colors items-center cursor-pointer"
            >
                <Building className="mr-1.5 h-3.5 w-3.5" />
                Ver imóveis
            </div>
        )
    }

    // Default for Client or unresolved lead statuses
    return (
        <div className="flex bg-secondary/50 hover:bg-secondary text-secondary-foreground text-xs font-medium px-3 py-1.5 rounded-md transition-colors items-center cursor-pointer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Abrir
        </div>
    )
}
