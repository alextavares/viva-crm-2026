"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

type Props = {
    contactId: string
    status: string
}

export function ContactStatusActions({ contactId, status }: Props) {
    const router = useRouter()
    const supabase = createClient()
    const [isUpdating, setIsUpdating] = useState(false)

    const canMarkContacted = status === "new"
    const canMarkQualified = status === "new" || status === "contacted"

    if (!canMarkContacted && !canMarkQualified) {
        return null
    }

    const updateStatus = async (
        nextStatus: "contacted" | "qualified",
        successMessage: string
    ) => {
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

    return (
        <>
            {canMarkContacted && (
                <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isUpdating}
                    onClick={() => updateStatus("contacted", "Lead marcado como em atendimento.")}
                >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    {isUpdating ? "Atualizando..." : "Atender"}
                </Button>
            )}

            {!canMarkContacted && canMarkQualified && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                    disabled={isUpdating}
                    onClick={() => updateStatus("qualified", "Lead marcado como qualificado.")}
                >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    {isUpdating ? "Atualizando..." : "Qualificar"}
                </Button>
            )}
        </>
    )
}
