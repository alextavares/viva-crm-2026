'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Edit as EditIcon, Trash2 as TrashIcon, Loader2 as LoaderIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { isAdmin } from '@/lib/types'

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

export function AppointmentActions({ appointmentId }: { appointmentId: string }) {
    const [isDeleting, setIsDeleting] = useState(false)
    const router = useRouter()
    const { role } = useAuth()
    const supabase = createClient()

    // Check if user can delete (Owner or Manager)
    // Broker CANNOT delete appointments per schema
    const canDelete = isAdmin(role)

    async function handleDelete() {
        setIsDeleting(true)
        try {
            const { error } = await supabase
                .from('appointments')
                .delete()
                .eq('id', appointmentId)

            if (error) throw error

            toast.success("Agendamento excluído com sucesso")
            router.push('/appointments')
            router.refresh()
        } catch (error) {
            console.error('Error deleting appointment:', error)
            toast.error("Erro ao excluir agendamento")
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex gap-2">
            <Link href={`/appointments/${appointmentId}/edit`}>
                <Button variant="outline" size="sm">
                    <EditIcon className="h-4 w-4 mr-2" />
                    Editar
                </Button>
            </Link>

            {canDelete && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                            {isDeleting ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4 mr-2" />}
                            Excluir
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Isso excluirá permanentemente o agendamento.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    )
}
