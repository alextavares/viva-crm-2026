"use client"

import { Button } from "@/components/ui/button"

export default function AttendancesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <h2 className="text-lg font-semibold">Nao foi possivel carregar atendimentos</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error.message || "Tente novamente em alguns instantes."}</p>
      <Button type="button" className="mt-4" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  )
}
