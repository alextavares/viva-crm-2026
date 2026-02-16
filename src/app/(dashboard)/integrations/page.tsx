import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { PORTALS, PORTAL_LABEL, type PortalIntegrationRow, type PortalKey, type PortalIntegrationRunRow } from "@/lib/integrations"
import { Settings2, RefreshCw, FileText, Link2 } from "lucide-react"

function statusBadge(status: PortalIntegrationRow["status"]) {
    switch (status) {
        case "active":
            return <Badge variant="secondary">Ativo</Badge>
        case "attention":
            return <Badge variant="outline">Atenção</Badge>
        case "error":
            return <Badge variant="destructive">Erro</Badge>
        case "inactive":
        default:
            return <Badge variant="outline">Inativo</Badge>
    }
}

function humanLastSync(iso: string | null) {
    if (!iso) return "Nunca"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "Nunca"
    return d.toLocaleString("pt-BR")
}

function portalSummary(portal: PortalKey) {
    switch (portal) {
        case "zap_vivareal":
            return "Envie seus imóveis e receba leads do ZAP e VivaReal."
        case "olx":
            return "Envie seus imóveis e receba leads da OLX."
        case "imovelweb":
            return "Envie seus imóveis e receba leads do Imovelweb."
    }
}

export default async function IntegrationsPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        // middleware should redirect, but keep safe on server rendering
        return null
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single()

    const organizationId = profile?.organization_id ?? null
    const role = (profile?.role as string | null) ?? null
    const canManage = role === "owner" || role === "manager"

    let integrations: PortalIntegrationRow[] = []

    if (organizationId) {
        const { data } = await supabase
            .from("portal_integrations")
            .select("*")
            .eq("organization_id", organizationId)

        integrations = (data as PortalIntegrationRow[] | null) ?? []
    }

    const byPortal = new Map<PortalKey, PortalIntegrationRow>()
    for (const row of integrations) byPortal.set(row.portal, row)

    const issuesCountByPortal = new Map<PortalKey, number>()
    const lastRunByPortal = new Map<PortalKey, PortalIntegrationRunRow>()

    if (organizationId) {
        for (const portal of PORTALS) {
            const [{ count: issuesCount }, { data: runsData }] = await Promise.all([
                supabase
                    .from("portal_integration_issues")
                    .select("id", { count: "exact", head: true })
                    .eq("organization_id", organizationId)
                    .eq("portal", portal)
                    .eq("is_resolved", false),
                supabase
                    .from("portal_integration_runs")
                    .select("*")
                    .eq("organization_id", organizationId)
                    .eq("portal", portal)
                    .order("created_at", { ascending: false })
                    .limit(1),
            ])

            issuesCountByPortal.set(portal, issuesCount ?? 0)
            const last = (runsData as PortalIntegrationRunRow[] | null)?.[0] ?? null
            if (last) lastRunByPortal.set(portal, last)
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Integrações</h1>
                <p className="text-muted-foreground">
                    Conecte portais e automatize publicação e recebimento de leads. (MVP: estrutura pronta, conectores em evolução.)
                </p>
            </div>

            {!organizationId ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Organização não configurada</CardTitle>
                        <CardDescription>
                            Seu usuário ainda não possui uma organização vinculada. Isso impede integrar portais.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {PORTALS.map((portal) => {
                    const row = byPortal.get(portal) ?? null
                    const status = row?.status ?? "inactive"
                    const lastSync = humanLastSync(row?.last_sync_at ?? null)
                    const hasError = (row?.last_error ?? "").trim().length > 0
                    const issuesCount = issuesCountByPortal.get(portal) ?? 0
                    const lastRun = lastRunByPortal.get(portal) ?? null

                    return (
                        <Card key={portal}>
                            <CardHeader className="space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1">
                                        <CardTitle className="text-base">{PORTAL_LABEL[portal]}</CardTitle>
                                        <CardDescription className="text-xs">
                                            {portalSummary(portal)}
                                        </CardDescription>
                                    </div>
                                    {statusBadge(status)}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-xs text-muted-foreground">
                                    <div>Última sincronização: {lastSync}</div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span>Pendências: <span className="font-medium">{issuesCount}</span></span>
                                        {lastRun ? (
                                            <span>
                                                Último: <span className="font-medium">{lastRun.kind === "test_feed" ? "Teste" : "Análise"}</span>{" "}
                                                ({lastRun.status === "ok" ? "OK" : "Erro"})
                                            </span>
                                        ) : (
                                            <span>Último: <span className="font-medium">-</span></span>
                                        )}
                                    </div>
                                    {hasError ? (
                                        <div className="text-destructive mt-1 line-clamp-2">
                                            {row?.last_error}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <Link href={`/integrations/${portal}`}>
                                        <Button className="w-full" variant={canManage ? "default" : "outline"}>
                                            <Link2 className="h-4 w-4 mr-2" />
                                            {canManage ? "Conectar / Configurar" : "Ver detalhes"}
                                        </Button>
                                    </Link>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Link href={`/integrations/${portal}/report`}>
                                            <Button variant="outline" className="w-full">
                                                <FileText className="h-4 w-4 mr-2" />
                                                Relatório
                                            </Button>
                                        </Link>
                                        <Button variant="outline" className="w-full" disabled title="Em breve">
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Sincronizar
                                        </Button>
                                    </div>
                                    <Button variant="ghost" className="w-full" disabled title="Em breve">
                                        <Settings2 className="h-4 w-4 mr-2" />
                                        Avançado
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
