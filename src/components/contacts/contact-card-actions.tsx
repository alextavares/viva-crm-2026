'use client'

import { Button } from "@/components/ui/button"
import { Trash2, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
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

interface ContactActionsProps {
    contactId: string
}

export function ContactActions({ contactId }: ContactActionsProps) {
    const router = useRouter()
    const { role } = useAuth()
    const [isDeleting, setIsDeleting] = useState(false)
    const supabase = createClient()
    const canDelete = isAdmin(role)

    async function handleDelete() {
        setIsDeleting(true)
        try {
            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', contactId)

            if (error) {
                console.error('Error deleting contact:', error)
                toast.error("Erro ao excluir contato. Verifique se você tem permissão.")
                return
            }

            toast.success("Contato excluído com sucesso.")
            router.refresh()
        } catch (error) {
            console.error('Unexpected error:', error)
            toast.error("Erro inesperado ao excluir contato.")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
            <Link href={`/contacts/${contactId}`} onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 bg-background/80 hover:bg-background">
                    <Pencil className="h-4 w-4" />
                </Button>
            </Link>

            {canDelete && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive bg-background/80" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O contato será permanentemente removido.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                {isDeleting ? "Excluindo..." : "Excluir"}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    )
}

