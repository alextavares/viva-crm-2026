'use client'

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ContactDetailError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("Contact detail route error:", error)
    }, [error])

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
            <div className="mb-4 rounded-full bg-destructive/10 p-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">Não foi possível carregar a ficha do contato</h2>
            <p className="mb-6 max-w-md text-muted-foreground">
                Houve um problema ao abrir esta ficha. Tente novamente.
            </p>
            <Button onClick={reset} variant="outline">
                Tentar novamente
            </Button>
        </div>
    )
}
