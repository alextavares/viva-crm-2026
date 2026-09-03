"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { updatePropertySiteVisibility } from "@/app/actions/properties"

type Props = {
  propertyId: string
  hideFromSite: boolean | null
  onOptimisticToggle?: (nextHidden: boolean) => void
  onRevertToggle?: () => void
}

export function PropertySiteVisibilityToggle({
  propertyId,
  hideFromSite,
  onOptimisticToggle,
  onRevertToggle,
}: Props) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const hidden = hideFromSite === true

  const onToggle = async () => {
    const nextHidden = !hidden
    setErrorMsg(null)
    onOptimisticToggle?.(nextHidden)
    startTransition(async () => {
      try {
        const result = await updatePropertySiteVisibility({
          propertyId,
          hideFromSite: nextHidden,
        })

        if (!result.success) {
          onRevertToggle?.()
          setErrorMsg(result.error)
          toast.error(result.error)
          return
        }

        toast.success(hidden ? "Imóvel publicado no site." : "Imóvel ocultado do site.")
        router.refresh()
      } catch (err) {
        console.error("Property visibility toggle error:", err)
        onRevertToggle?.()
        const message =
          err instanceof Error
            ? err.message
            : "Não foi possível atualizar a visibilidade do imóvel."
        setErrorMsg(message)
        toast.error(message)
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onToggle}
        disabled={pending}
        className="gap-1.5"
        title={hidden ? "Publicar no site" : "Ocultar do site"}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : hidden ? (
          <Eye className="h-3.5 w-3.5" />
        ) : (
          <EyeOff className="h-3.5 w-3.5" />
        )}
        {hidden ? "Publicar no site" : "Ocultar do site"}
      </Button>
      {errorMsg ? <span className="text-[11px] text-red-600">{errorMsg}</span> : null}
    </div>
  )
}

