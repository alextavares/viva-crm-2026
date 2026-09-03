"use client"

import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

type PropertyFormSaveBarProps = {
  isLoading: boolean
  isEdit: boolean
  hasErrors: boolean
  statusText?: string
  onCancel?: () => void
}

export function PropertyFormSaveBar({
  isLoading,
  isEdit,
  hasErrors,
  statusText,
  onCancel,
}: PropertyFormSaveBarProps) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {isEdit ? "Salvar alterações do imóvel" : "Cadastrar imóvel"}
          </div>
          <div className="text-xs text-muted-foreground">
            {statusText
              ? statusText
              : hasErrors
                ? "Revise as pendências destacadas antes de seguir."
                : "Você pode salvar em qualquer etapa sem perder o progresso."}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {onCancel ? (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isLoading ? "Salvando..." : isEdit ? "Salvar alterações" : "Cadastrar imóvel"}
          </Button>
        </div>
      </div>
    </div>
  )
}
