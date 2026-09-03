"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { savePortalIntegrationConfig } from "@/app/actions/integrations"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { type PortalKey } from "@/lib/integrations"

function asBool(value: FormDataEntryValue | null) {
  return value === "on" || value === "true" || value === "1"
}

function pickStr(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" ? value : fallback
}

type Props = {
  portal: PortalKey
  canManage: boolean
  integrationStatus: "active" | "inactive" | "attention" | "error" | "enabled" | "disabled" | null
  exportEnabled: boolean
  feedUrl: string
  assignment: string
  assignmentFallback: string
  slaMinutes: number
  codigoImobiliaria: string
  tipoPublicacaoDefault: string
  defaultLocalidadeId: string
  nomeContato: string
  emailContato: string
  telefoneContato: string
  mostrarMapa: string
  localidadeMappingsRaw: string
  sendOnlyAvailable: boolean
  sendOnlyWithPhotos: boolean
}

export function IntegrationPortalSettingsForm({
  portal,
  canManage,
  integrationStatus,
  exportEnabled,
  feedUrl,
  assignment,
  assignmentFallback,
  slaMinutes,
  codigoImobiliaria,
  tipoPublicacaoDefault,
  defaultLocalidadeId,
  nomeContato,
  emailContato,
  telefoneContato,
  mostrarMapa,
  localidadeMappingsRaw,
  sendOnlyAvailable,
  sendOnlyWithPhotos,
}: Props) {
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [rotatedSecrets, setRotatedSecrets] = useState<{ feed: string; webhook: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMsg(null)

    const formData = new FormData(event.currentTarget)

    startTransition(() => {
      void (async () => {
        const result = await savePortalIntegrationConfig({
          portal,
          enabled: asBool(formData.get("enabled")),
          exportEnabled: asBool(formData.get("export_enabled")),
          sendOnlyAvailable: asBool(formData.get("send_only_available")),
          sendOnlyWithPhotos: asBool(formData.get("send_only_with_photos")),
          leadAssignment: pickStr(formData.get("lead_assignment"), "by_property") as
            | "by_property"
            | "round_robin"
            | "owner_manager",
          leadAssignmentFallback: pickStr(formData.get("lead_assignment_fallback"), "owner_manager") as
            | "owner_manager"
            | "round_robin",
          slaMinutes: Number(pickStr(formData.get("sla_minutes"), "15")),
          codigoImobiliaria: pickStr(formData.get("codigo_imobiliaria")),
          tipoPublicacaoDefault: pickStr(formData.get("tipo_publicacao_default"), "SIMPLE"),
          defaultLocalidadeId: pickStr(formData.get("default_localidade_id")),
          nomeContato: pickStr(formData.get("nome_contato")),
          emailContato: pickStr(formData.get("email_contato")),
          telefoneContato: pickStr(formData.get("telefone_contato")),
          mostrarMapa: pickStr(formData.get("mostrar_mapa"), "NO") as "NO" | "EXACTO" | "APROXIMADO" | "EXATO",
          localidadeMappingsRaw: pickStr(formData.get("localidade_mappings_raw")),
        })

        if (!result.success) {
          setErrorMsg(result.error)
          toast.error(result.error)
          return
        }

        toast.success("Configuração do portal salva.")
        if (result.data?.feedSecretOnce || result.data?.webhookSecretOnce) {
          setRotatedSecrets({
            feed: result.data.feedSecretOnce ?? "",
            webhook: result.data.webhookSecretOnce ?? "",
          })
        }
        router.refresh()
      })()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-md border p-3">
        <div>
          <div className="font-medium">Ativar integração</div>
          <div className="text-xs text-muted-foreground">
            Liga/desliga o conector e mantém as configurações salvas.
          </div>
        </div>
        <input name="enabled" type="checkbox" defaultChecked={integrationStatus === "active" || integrationStatus === "enabled"} disabled={!canManage || isPending} />
      </div>
      {rotatedSecrets ? (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium">Novas credenciais geradas — copie agora, elas não serão exibidas novamente.</p>
          <p><span className="font-medium">Segredo do feed:</span> <code className="break-all">{rotatedSecrets.feed}</code></p>
          <p><span className="font-medium">Segredo do webhook:</span> <code className="break-all">{rotatedSecrets.webhook}</code></p>
        </div>
      ) : null}
      {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}
    </form>
  )
}
