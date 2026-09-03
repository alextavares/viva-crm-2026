"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { updateContactStatus } from "@/app/actions/contacts"

type Props = {
    contactId: string
    status: string
}

export function ContactStatusActions({ contactId, status }: Props) {
    const router = useRouter()
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const canMarkContacted = status === "new"
    const canMarkQualified = status === "new" || status === "contacted"

    if (!canMarkContacted && !canMarkQualified) {
        return null
    }

    const updateStatus = async (
        nextStatus: "contacted" | "qualified",
        successMessage: string
    ) => {
        setErrorMsg(null)

        startTransition(() => {
            void (async () => {
                const result = await updateContactStatus(contactId, nextStatus)
                if (!result.success) {
                    setErrorMsg(result.error)
                    toast.error(result.error)
                    return
                }

                toast.success(successMessage)
                router.refresh()
            })()
        })
    }

    return (
        <div className="flex flex-col items-start gap-1.5">
            {canMarkContacted && (
                <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={isPending}
                    onClick={() => updateStatus("contacted", "Lead marcado como em atendimento.")}
                >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    {isPending ? "Atualizando..." : "Iniciar atendimento"}
                </Button>
            )}

            {!canMarkContacted && canMarkQualified && (
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                    disabled={isPending}
                    onClick={() => updateStatus("qualified", "Lead marcado como qualificado.")}
                >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    {isPending ? "Atualizando..." : "Qualificar lead"}
                </Button>
            )}
            {errorMsg ? <p className="text-xs text-red-600">{errorMsg}</p> : null}
        </div>
    )
}
