"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Eye, EyeOff, Loader2 } from "lucide-react"

type Props = {
  propertyId: string
  hideFromSite: boolean | null
}

export function PropertySiteVisibilityToggle({ propertyId, hideFromSite }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const hidden = hideFromSite === true

  const onToggle = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from("properties")
        .update({ hide_from_site: !hidden })
        .eq("id", propertyId)

      if (error) throw error

      toast.success(hidden ? "Imóvel publicado no site." : "Imóvel ocultado do site.")
      router.refresh()
    } catch (err) {
      console.error("Property visibility toggle error:", err)
      toast.error("Não foi possível atualizar visibilidade do imóvel.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onToggle}
      disabled={saving}
      className="gap-1.5"
      title={hidden ? "Publicar no site" : "Ocultar do site"}
    >
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : hidden ? (
        <Eye className="h-3.5 w-3.5" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" />
      )}
      {hidden ? "Publicar no site" : "Ocultar do site"}
    </Button>
  )
}

