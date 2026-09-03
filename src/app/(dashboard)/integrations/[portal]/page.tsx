import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { PORTALS, PORTAL_LABEL, type PortalIntegrationRow, type PortalKey } from "@/lib/integrations"
import { headers } from "next/headers"
import { IntegrationPortalSettingsForm } from "./integration-portal-settings-form"

async function getOrigin() {
    const h = await headers()
    const proto = h.get("x-forwarded-proto") ?? "http"
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3015"
    return `${proto}://${host}`
}

function buildFeedUrl(origin: string, portal: PortalKey, organizationSlug: string | null, feedToken: string) {
    if (!feedToken) return ""

    if (organizationSlug) {
        if (portal === "imovelweb") {
            return `${origin}/api/public/s/${organizationSlug}/imovelweb-xml?token=${feedToken}`
        }

        if (portal === "zap_vivareal") {
            return `${origin}/api/public/s/${organizationSlug}/zap-xml?token=${feedToken}`
        }
    }

    return `${origin}/api/feeds/${portal}/${feedToken}`
}

export default async function IntegrationPortalPage({
    params,
}: {
    params: Promise<{ portal: string }>
}) {
    const { portal } = await params
    if (!PORTALS.includes(portal as PortalKey)) return notFound()

    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single()

    const role = (profile?.role as string | null) ?? null
    const canManage = role === "owner" || role === "manager"
    const organizationId = profile?.organization_id ?? null
    let organizationSlug: string | null = null

    let integration: PortalIntegrationRow | null = null
    if (organizationId) {
        const { data: organization } = await supabase
            .from("organizations")
            .select("slug")
            .eq("id", organizationId)
            .maybeSingle()

        organizationSlug = organization?.slug ?? null

        const { data } = await supabase
            .from("portal_integrations")
            .select("*")
            .eq("organization_id", organizationId)
            .eq("portal", portal)
            .maybeSingle()
        integration = (data as PortalIntegrationRow | null) ?? null
    }

    const config = (integration?.config ?? {}) as Record<string, unknown>
    const exportEnabled = Boolean(config["export_enabled"])
    const feedToken = typeof config["feed_token"] === "string" ? (config["feed_token"] as string) : ""
    const origin = await getOrigin()
    const feedUrl = buildFeedUrl(origin, portal as PortalKey, organizationSlug, feedToken)

    const assignment = (config["lead_assignment"] as string | undefined) ?? "by_property"
    const assignmentFallback = (config["lead_assignment_fallback"] as string | undefined) ?? "owner_manager"
    const slaMinutes = Number(config["sla_minutes"] ?? 15)
    const codigoImobiliaria = typeof config["codigo_imobiliaria"] === "string" ? (config["codigo_imobiliaria"] as string) : ""
    const tipoPublicacaoDefault = typeof config["tipo_publicacao_default"] === "string" ? (config["tipo_publicacao_default"] as string) : "SIMPLE"
    const defaultLocalidadeId = typeof config["default_localidade_id"] === "string" ? (config["default_localidade_id"] as string) : ""
    const nomeContato = typeof config["nome_contato"] === "string" ? (config["nome_contato"] as string) : ""
    const emailContato = typeof config["email_contato"] === "string" ? (config["email_contato"] as string) : ""
    const telefoneContato = typeof config["telefone_contato"] === "string" ? (config["telefone_contato"] as string) : ""
    const mostrarMapaConfig = config["mostrar_mapa"]
    const mostrarMapa =
        typeof mostrarMapaConfig === "string"
            ? mostrarMapaConfig.toUpperCase() === "EXATO"
                ? "EXACTO"
                : (mostrarMapaConfig as string)
            : mostrarMapaConfig === true
                ? "EXACTO"
                : "NO"
    const localidadeMappingsRaw =
        typeof config["localidade_mappings_raw"] === "string" ? (config["localidade_mappings_raw"] as string) : ""

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">{PORTAL_LABEL[portal as PortalKey]}</h1>
                    <p className="text-muted-foreground">
                        Configure publicação e recebimento de leads do portal.
                    </p>
                </div>
                <Link href="/integrations">
                    <Button variant="outline">Voltar</Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Conectar portal</CardTitle>
                    <CardDescription>
                        {canManage
                            ? "Salve regras de publicação e atendimento. Segredos não ficam no navegador."
                            : "Apenas gestores podem conectar ou editar integrações."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {!organizationId ? (
                        <div className="text-sm text-muted-foreground">
                            Sua conta não tem organização vinculada, então não é possível configurar integrações.
                        </div>
                    ) : (
                        <IntegrationPortalSettingsForm
                            portal={portal as PortalKey}
                            canManage={canManage}
                            integrationStatus={integration?.status ?? null}
                            exportEnabled={exportEnabled}
                            feedToken={feedToken}
                            feedUrl={feedUrl}
                            assignment={assignment}
                            assignmentFallback={assignmentFallback}
                            slaMinutes={slaMinutes}
                            codigoImobiliaria={codigoImobiliaria}
                            tipoPublicacaoDefault={tipoPublicacaoDefault}
                            defaultLocalidadeId={defaultLocalidadeId}
                            nomeContato={nomeContato}
                            emailContato={emailContato}
                            telefoneContato={telefoneContato}
                            mostrarMapa={mostrarMapa}
                            localidadeMappingsRaw={localidadeMappingsRaw}
                            sendOnlyAvailable={Boolean(config["send_only_available"] ?? true)}
                            sendOnlyWithPhotos={Boolean(config["send_only_with_photos"] ?? true)}
                        />
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Atalhos</CardTitle>
                    <CardDescription>Relatórios e pendências de operação.</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                    <Link href={`/integrations/${portal}/report`}>
                        <Button variant="outline">Abrir relatório</Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    )
}
