"use client"

import { useState, useTransition, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ExternalLink, Building } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { updateContactStatus } from "@/app/actions/contacts"

type Props = {
    contactId: string
    type: string
    status: string
    onOptimisticUpdate?: (nextStatus: string) => void
    onRevertUpdate?: () => void
}

export function ContactListPrimaryAction({ contactId, type, status, onOptimisticUpdate, onRevertUpdate }: Props) {
    const router = useRouter()
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const updateStatus = async (
        event: MouseEvent<HTMLButtonElement>,
        nextStatus: "contacted" | "qualified",
        successMessage: string
    ) => {
        event.preventDefault()
        event.stopPropagation()

        setErrorMsg(null)
        if (onOptimisticUpdate) onOptimisticUpdate(nextStatus)

        startTransition(() => {
            void (async () => {
                const result = await updateContactStatus(contactId, nextStatus)
                if (!result.success) {
                    setErrorMsg(result.error)
                    toast.error(result.error)
                    if (onRevertUpdate) onRevertUpdate()
                    return
                }

                toast.success(successMessage)
                router.refresh()
            })()
        })
    }

    if (type === "lead") {
        if (status === "new") {
            return (
                <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-start gap-1.5">
                    <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        disabled={isPending}
                        onClick={(e) => updateStatus(e, "contacted", "Lead marcado como em atendimento.")}
                    >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {isPending ? "Atualizando..." : "Iniciar atendimento"}
                    </Button>
                    {errorMsg ? <p className="text-xs text-red-600">{errorMsg}</p> : null}
                </div>
            )
        }
        if (status === "contacted") {
            return (
                <div onClick={(e) => e.stopPropagation()} className="flex flex-col items-start gap-1.5">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                        disabled={isPending}
                        onClick={(e) => updateStatus(e, "qualified", "Lead marcado como qualificado.")}
                    >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        {isPending ? "Atualizando..." : "Qualificar lead"}
                    </Button>
                    {errorMsg ? <p className="text-xs text-red-600">{errorMsg}</p> : null}
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
                Ver imóveis do proprietário
            </div>
        )
    }

    // Default for Client or unresolved lead statuses
    return (
        <div className="flex bg-secondary/50 hover:bg-secondary text-secondary-foreground text-xs font-medium px-3 py-1.5 rounded-md transition-colors items-center cursor-pointer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Abrir ficha
        </div>
    )
}
