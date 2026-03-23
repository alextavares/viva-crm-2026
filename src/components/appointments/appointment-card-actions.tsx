"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Edit as EditIcon, Trash2 as TrashIcon, Loader2 as LoaderIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { isAdmin } from "@/lib/types"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type Props = {
    appointmentId: string
    onOptimisticDelete?: () => void
    onRevertDelete?: () => void
}

export function AppointmentCardActions({ appointmentId, onOptimisticDelete, onRevertDelete }: Props) {
    const router = useRouter()
    const supabase = createClient()
    const { role } = useAuth()
    const [isDeleting, setIsDeleting] = useState(false)

    const canDelete = isAdmin(role)

    const handleDelete = async () => {
        setIsDeleting(true)
        if (onOptimisticDelete) onOptimisticDelete()

        try {
            const { error } = await supabase.from("appointments").delete().eq("id", appointmentId)
            if (error) throw error

            toast.success("Visita excluída com sucesso.")
            router.refresh()
        } catch (error) {
            console.error("Error deleting appointment:", error)
            toast.error("Não foi possível excluir a visita.")
            if (onRevertDelete) onRevertDelete()
        } finally {
            setIsDeleting(false)
        }
    }

    // Prevent clicks from triggering the card link
    const preventNav = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    return (
        <div
            className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2"
            onClick={preventNav}
        >
            <Link href={`/appointments/${appointmentId}/edit`}>
                <Button size="icon" variant="secondary" className="h-8 w-8 shadow-sm">
                    <EditIcon className="h-4 w-4" />
                    <span className="sr-only">Editar visita</span>
                </Button>
            </Link>
            {canDelete && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button size="icon" variant="destructive" className="h-8 w-8 shadow-sm" disabled={isDeleting}>
                            {isDeleting ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
                            <span className="sr-only">Excluir visita</span>
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A visita será excluída permanentemente.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={preventNav}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    preventNav(e)
                                    handleDelete()
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    )
}
