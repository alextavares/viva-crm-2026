"use client"

import Link from "next/link"
import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { savePortalIntegrationConfig } from "@/app/actions/integrations"
import { FeedTester } from "./feed-tester"
import { Button } from "@/components/ui/button"
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
  integrationStatus: "active" | "inactive" | "attention" | "error" | null
  exportEnabled: boolean
  feedToken: string
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
  feedToken,
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
          existingFeedToken: feedToken,
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
        <input name="enabled" type="checkbox" defaultChecked={integrationStatus === "active"} disabled={!canManage || isPending} />
      </div>

      <div className="space-y-3 rounded-md border p-3">
        <div>
          <div className="font-medium">Envio de imóveis (Feed)</div>
          <div className="text-xs text-muted-foreground">
            A URL do feed é pública e deve ser tratada como “link privado”.
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-sm">Ativar publicação</Label>
          <input name="export_enabled" type="checkbox" defaultChecked={exportEnabled} disabled={!canManage || isPending} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm">Somente disponíveis</Label>
            <input
              name="send_only_available"
              type="checkbox"
              defaultChecked={sendOnlyAvailable}
              disabled={!canManage || isPending}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm">Somente com fotos</Label>
            <input
              name="send_only_with_photos"
              type="checkbox"
              defaultChecked={sendOnlyWithPhotos}
              disabled={!canManage || isPending}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm">URL do feed</Label>
          <Input readOnly value={feedUrl || "Salve para gerar a URL do feed"} />
          <div className="text-xs text-muted-foreground">
            Se você rotacionar esse link no futuro, o portal precisará ser atualizado.
          </div>
        </div>
      </div>

      {portal === "imovelweb" ? (
        <div className="space-y-3 rounded-md border p-3">
          <div>
            <div className="font-medium">Configuração do Imovelweb</div>
            <div className="text-xs text-muted-foreground">
              Campos exigidos para montar o feed aceito pelo portal.
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm" htmlFor="codigo_imobiliaria">Código da imobiliária</Label>
              <Input id="codigo_imobiliaria" name="codigo_imobiliaria" defaultValue={codigoImobiliaria} disabled={!canManage || isPending} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm" htmlFor="tipo_publicacao_default">Tipo de publicação padrão</Label>
              <select
                id="tipo_publicacao_default"
                name="tipo_publicacao_default"
                defaultValue={tipoPublicacaoDefault}
                disabled={!canManage || isPending}
                className="border-input bg-transparent w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="SIMPLE">Simple</option>
                <option value="DESTACADO">Destacado</option>
                <option value="HOME">Home</option>
                <option value="GRATIS">Gratis</option>
                <option value="ALQUILER_SIMPLE">Alquiler Simple</option>
                <option value="EXCLUSIVE">Exclusive</option>
                <option value="EXCLUSIVE_II">Exclusive II</option>
                <option value="DESARROLLOS_HOME">Desarrollos Home</option>
                <option value="DESARROLLOS_DESTACADO">Desarrollos Destacado</option>
                <option value="DESARROLLOS_SIMPLE">Desarrollos Simple</option>
                <option value="DESARROLLOS_GRATIS">Desarrollos Gratis</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm" htmlFor="default_localidade_id">ID de localidade padrão</Label>
              <Input id="default_localidade_id" name="default_localidade_id" defaultValue={defaultLocalidadeId} disabled={!canManage || isPending} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm" htmlFor="mostrar_mapa">Mostrar mapa</Label>
              <select
                id="mostrar_mapa"
                name="mostrar_mapa"
                defaultValue={mostrarMapa}
                disabled={!canManage || isPending}
                className="border-input bg-transparent w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="NO">Não mostrar</option>
                <option value="EXACTO">Exato</option>
                <option value="APROXIMADO">Aproximado</option>
              </select>
              <div className="text-xs text-muted-foreground">
                Use conforme a regra de exibição de mapa contratada no portal.
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm" htmlFor="nome_contato">Nome do contato</Label>
              <Input id="nome_contato" name="nome_contato" defaultValue={nomeContato} disabled={!canManage || isPending} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm" htmlFor="email_contato">Email do contato</Label>
              <Input id="email_contato" name="email_contato" type="email" defaultValue={emailContato} disabled={!canManage || isPending} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm" htmlFor="telefone_contato">Telefone do contato</Label>
              <Input id="telefone_contato" name="telefone_contato" defaultValue={telefoneContato} disabled={!canManage || isPending} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-sm" htmlFor="localidade_mappings_raw">Mapa de localidade por cidade/UF</Label>
              <Textarea
                id="localidade_mappings_raw"
                name="localidade_mappings_raw"
                defaultValue={localidadeMappingsRaw}
                disabled={!canManage || isPending}
                className="min-h-[130px] font-mono text-xs"
              />
              <div className="text-xs text-muted-foreground">
                Uma linha por cidade ou bairro no formato <code>UF|Cidade=ID</code> ou <code>UF|Cidade|Bairro=ID</code>.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {canManage ? <FeedTester feedUrl={feedUrl} portal={portal} /> : null}

      <div className="space-y-3 rounded-md border p-3">
          <div>
            <div className="font-medium">Recebimento de leads</div>
            <div className="text-xs text-muted-foreground">
            Regras de entrada dos leads recebidos pelo portal.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-sm">Atribuição padrão</Label>
            <select
              name="lead_assignment"
              defaultValue={assignment}
              disabled={!canManage || isPending}
              className="border-input bg-transparent w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="by_property">Por imóvel (responsável)</option>
              <option value="round_robin">Distribuição automática</option>
              <option value="owner_manager">Gestores</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Fallback (se não achar responsável)</Label>
            <select
              name="lead_assignment_fallback"
              defaultValue={assignmentFallback}
              disabled={!canManage || isPending}
              className="border-input bg-transparent w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="owner_manager">Gestores</option>
              <option value="round_robin">Distribuição automática</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">SLA (alertar sem resposta)</Label>
            <select
              name="sla_minutes"
              defaultValue={String(slaMinutes)}
              disabled={!canManage || isPending}
              className="border-input bg-transparent w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="5">5 min</option>
              <option value="15">15 min</option>
              <option value="60">1 hora</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link href={`/integrations/${portal}/report`}>
          <Button variant="outline" type="button">Ver relatório</Button>
        </Link>
        <Button type="submit" disabled={!canManage || isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}
    </form>
  )
}
