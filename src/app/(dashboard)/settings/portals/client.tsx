"use client"
import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Copy, Play, Pause, ExternalLink } from "lucide-react"
import { togglePortalIntegration } from "@/app/actions/settings"
import { isPortalIntegrationActive } from "@/lib/integrations/portal-credentials"

// Available Portals defined here
const AVAILABLE_PORTALS = [
    {
        id: "zap_vivareal",
        name: "Zap Imóveis / VivaReal (DataZAP)",
        description: "Sincroniza automaticamente a carteira com o padrão OLX/Grupo ZAP.",
        endpoint: "zap-xml"
    },
    {
        id: "imovelweb",
        name: "Imovelweb (DataWeb)",
        description: "Exportação em XML suportada pelo esquema de ingestão do Imovelweb.",
        endpoint: "imovelweb-xml"
    }
]

export default function PortalIntegrationsClient({
    orgSlug,
    initialIntegrations,
}: {
    orgSlug: string
    initialIntegrations: Record<string, unknown>[]
}) {
    const router = useRouter()
    const [integrations, setIntegrations] = useState(initialIntegrations)
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [portalErrors, setPortalErrors] = useState<Record<string, string | null>>({})
    const [lastSecrets, setLastSecrets] = useState<Record<string, { feed: string; webhook: string }>>({})

    const handleToggleStatus = async (portalId: string, currentIntegration?: Record<string, unknown>) => {
        setLoadingId(portalId)
        setPortalErrors((prev) => ({ ...prev, [portalId]: null }))
        const isCurrentlyActive = isPortalIntegrationActive(currentIntegration?.status)

        const result = await togglePortalIntegration({
            portal: portalId as "zap_vivareal" | "imovelweb",
        })

        setLoadingId(null)

        if (!result.success) {
            setPortalErrors((prev) => ({ ...prev, [portalId]: result.error }))
            toast.error(result.error)
            return
        }

        if (result.data?.feedSecretOnce || result.data?.webhookSecretOnce) {
            setLastSecrets((prev) => ({
                ...prev,
                [portalId]: {
                    feed: result.data?.feedSecretOnce ?? "",
                    webhook: result.data?.webhookSecretOnce ?? "",
                },
            }))
        }

        setIntegrations((prev) => {
            const existing = prev.find(i => i.portal === portalId)
            const updatedIntegration = result.data?.integration ?? {}
            if (existing) {
                return prev.map(i => i.portal === portalId ? updatedIntegration : i)
            }
            return [...prev, updatedIntegration]
        })

        router.refresh()
        toast.success(`Integração com ${AVAILABLE_PORTALS.find(p => p.id === portalId)?.name} ${!isCurrentlyActive ? 'ativada' : 'pausada'}.`)
    }

    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text)
        toast.success("Link do Feed XML copiado para a área de transferência!")
    }, [])

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {AVAILABLE_PORTALS.map((portal) => {
                const integration = integrations.find((i) => i.portal === portal.id)
                const isActive = isPortalIntegrationActive(integration?.status)
                const isLoading = loadingId === portal.id
                const rotated = lastSecrets[portal.id]

                let feedUrl = ""
                let webhookUrl = ""
                if (orgSlug) {
                    // Canonical boundary: secrets live in private credentials
                    // (shown once on rotation below), so URLs carry no token.
                    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.vivacrm.com.br'
                    feedUrl = `${baseUrl}/api/public/s/${orgSlug}/${portal.endpoint}`
                    const webhookPortalType = portal.id === "zap_vivareal" ? "zap" : portal.id
                    webhookUrl = `${baseUrl}/api/public/webhooks/${orgSlug}/${webhookPortalType}`
                }

                return (
                    <Card key={portal.id} className="flex flex-col h-full border-solid border-border/60 shadow-sm transition-all hover:shadow-md">
                        <CardHeader className="pb-4 border-b bg-muted/20">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        {portal.name}
                                    </CardTitle>
                                    <CardDescription className="pt-2">{portal.description}</CardDescription>
                                </div>
                                {isActive ? (
                                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700">Ativo</Badge>
                                ) : (
                                    <Badge variant="secondary" className="text-muted-foreground">Pausado</Badge>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 pt-6 flex flex-col gap-4">

                            {isActive ? (
                                <div className="flex flex-col gap-2">
                                    <span className="text-sm font-medium text-foreground">URL Pública do Feed XML (Envio de Imóveis)</span>
                                    <p className="text-xs text-muted-foreground">Envie este link seguro para o seu gerente de contas no portal para automatizar a leitura diária dos imóveis.</p>

                                    <div className="flex w-full max-w-sm items-center space-x-2 mt-1">
                                        <Input
                                            type="url"
                                            readOnly
                                            value={feedUrl}
                                            className="font-mono text-xs text-muted-foreground bg-muted/50 cursor-pointer"
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                        />
                                        <Button
                                            onClick={() => copyToClipboard(feedUrl)}
                                            type="button"
                                            size="icon"
                                            variant="secondary"
                                            title="Copiar link"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    <span className="text-sm font-medium text-foreground mt-4">URL de Webhook (Recebimento de Leads)</span>
                                    <p className="text-xs text-muted-foreground">Configure esta URL no painel do portal parceiro para receber leads em tempo real diretamente na roleta.</p>

                                    <div className="flex w-full max-w-sm items-center space-x-2 mt-1">
                                        <Input
                                            type="url"
                                            readOnly
                                            value={webhookUrl}
                                            className="font-mono text-xs text-muted-foreground bg-muted/50 cursor-pointer"
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                        />
                                        <Button
                                            onClick={() => copyToClipboard(webhookUrl)}
                                            type="button"
                                            size="icon"
                                            variant="secondary"
                                            title="Copiar link"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    {rotated ? (
                                        <div className="mt-3 space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs">
                                            <p className="font-medium">Novas credenciais — copie agora, não serão exibidas novamente.</p>
                                            <p>Feed: <code className="break-all">{rotated.feed}</code></p>
                                            <p>Webhook: <code className="break-all">{rotated.webhook}</code></p>
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-24 bg-muted/30 rounded-md border border-dashed">
                                    <p className="text-sm text-muted-foreground text-center px-4">
                                        Integração desativada. Ative para gerar a chave de sincronização segura.
                                    </p>
                                </div>
                            )}

                            {Boolean(integration?.last_sync_at) && (
                                <div className="mt-auto pt-4 flex gap-2 text-xs text-muted-foreground bg-slate-50 p-2 rounded w-max border">
                                    <span className="font-semibold text-slate-700">Última leitura pelo portal: </span>
                                    {new Date(integration?.last_sync_at as string).toLocaleString('pt-BR')}
                                </div>
                            )}

                        </CardContent>
                        <CardFooter className="border-t bg-muted/10 flex-col items-stretch gap-2">
                            <div className="flex justify-between gap-2">
                                {isActive ? (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        disabled={isLoading}
                                        onClick={() => handleToggleStatus(portal.id, integration)}
                                    >
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pause className="mr-2 h-4 w-4" />}
                                        Pausar Sincronização
                                    </Button>
                                ) : (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        disabled={isLoading}
                                        onClick={() => handleToggleStatus(portal.id, integration)}
                                    >
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                                        Ativar Integração XML
                                    </Button>
                                )}

                                {isActive && (
                                    <a href={feedUrl} target="_blank" rel="noreferrer">
                                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-700">
                                            <ExternalLink className="mr-2 h-3 w-3" /> Visualizar Feed
                                        </Button>
                                    </a>
                                )}
                            </div>
                            {portalErrors[portal.id] ? (
                                <p className="text-xs text-red-600">{portalErrors[portal.id]}</p>
                            ) : null}
                        </CardFooter>
                    </Card>
                )
            })}
        </div>
    )
}
