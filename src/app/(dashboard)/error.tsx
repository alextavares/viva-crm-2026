'use client'

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("Dashboard error:", error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
                Algo deu errado
            </h2>
            <p className="text-muted-foreground max-w-md mb-6">
                Houve um problema ao carregar esta página. Tente novamente ou entre em
                contato com o suporte se o problema persistir.
            </p>
            <Button onClick={reset} variant="outline">
                Tentar Novamente
            </Button>
        </div>
    )
}
