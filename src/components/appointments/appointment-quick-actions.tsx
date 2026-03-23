"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { updateAppointmentStatusAction } from "@/app/actions/appointments"

type Props = {
    appointmentId: string
    status: string
    onOptimisticUpdate?: (nextStatus: string) => void
    onRevertUpdate?: () => void
}

export function AppointmentQuickActions({ appointmentId, status, onOptimisticUpdate, onRevertUpdate }: Props) {
    const router = useRouter()
    const [isUpdating, setIsUpdating] = useState(false)

    const updateStatus = async (
        e: Event | React.MouseEvent,
        nextStatus: string,
        successMessage: string
    ) => {
        e.preventDefault()
        e.stopPropagation()

        if (nextStatus === status) return

        setIsUpdating(true)
        if (onOptimisticUpdate) onOptimisticUpdate(nextStatus)

        try {
            await updateAppointmentStatusAction(appointmentId, nextStatus)
            toast.success(successMessage)
            router.refresh()
        } catch (error) {
            console.error(`Error updating appointment status to ${nextStatus}:`, error)
            toast.error("Não foi possível atualizar o status da visita.")
            if (onRevertUpdate) onRevertUpdate()
        } finally {
            setIsUpdating(false)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={isUpdating}
                    onClick={(e) => e.stopPropagation()}
                >
                    {isUpdating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : "Mudar Status"}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => updateStatus(e as unknown as Event, "scheduled", "Visita marcada como agendada.")}>
                    {status === "scheduled" && <Check className="mr-2 h-4 w-4" />}
                    Agendado
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => updateStatus(e as unknown as Event, "completed", "Visita marcada como realizada.")}>
                    {status === "completed" && <Check className="mr-2 h-4 w-4" />}
                    Realizado
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => updateStatus(e as unknown as Event, "cancelled", "Visita marcada como cancelada.")}>
                    {status === "cancelled" && <Check className="mr-2 h-4 w-4" />}
                    Cancelado
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => updateStatus(e as unknown as Event, "no_show", "Visita marcada como não compareceu.")}>
                    {status === "no_show" && <Check className="mr-2 h-4 w-4" />}
                    Não Compareceu
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
