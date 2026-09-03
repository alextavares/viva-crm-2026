'use client'

import { Button } from "@/components/ui/button"
import { Trash2, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { isAdmin } from "@/lib/types"
import { deleteContact } from "@/app/actions/contacts"
import {
    AlertDialog,
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
    onOptimisticDelete?: () => void
    onRevertDelete?: () => void
}

export function ContactActions({ contactId, onOptimisticDelete, onRevertDelete }: ContactActionsProps) {
    const router = useRouter()
    const { role } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const canDelete = isAdmin(role)

    async function handleDelete() {
        setErrorMsg(null)

        startTransition(() => {
            void (async () => {
                const result = await deleteContact(contactId)
                if (!result.success) {
                    onRevertDelete?.()
                    setErrorMsg(result.error)
                    toast.error(result.error)
                    setIsOpen(true)
                    return
                }

                onOptimisticDelete?.()
                setIsOpen(false)
                toast.success("Contato excluído com sucesso.")
                router.refresh()
            })()
        })
    }

    return (
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2">
            <Link href={`/contacts/${contactId}`} onClick={(e) => e.stopPropagation()}>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 bg-background/80 hover:bg-background"
                    aria-label="Abrir ficha"
                    title="Abrir ficha"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            </Link>

            {canDelete && (
                <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
                    <AlertDialogTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive bg-background/80"
                            onClick={(e) => {
                                e.stopPropagation()
                                setErrorMsg(null)
                            }}
                            aria-label="Excluir contato"
                            title="Excluir contato"
                        >
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
                        {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <Button
                                type="button"
                                onClick={handleDelete}
                                className="bg-destructive hover:bg-destructive/90"
                                disabled={isPending}
                            >
                                {isPending ? "Excluindo..." : "Excluir"}
                            </Button>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    )
}

